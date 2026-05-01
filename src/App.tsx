import { useEffect, useMemo, useRef, useState } from "react";

type FieldConfig = {
  type: "number" | "select";
  defaultUnit?: string;
  label: string;
  required?: boolean;
  options?: string[];
};

type CommandConfig = {
  label: string;
  fields: string[];
  hasRelative?: boolean;
};

type PathStep = {
  type: string;
  coorOpt?: string;
  [key: string]: string | null | undefined;
};

const UNITS = ["px", "rem", "em", "%", "vw", "vh", "vmin", "vmax", "custom"];
const COOR_OPTS = ["by", "to"];

const FIELD_TYPES: Record<string, FieldConfig> = {
  "fill-rule": {
    type: "select",
    options: ["nonzero", "evenodd"],
    label: "Fill Rule",
  },
  x: { type: "number", defaultUnit: "%", label: "X", required: true },
  y: { type: "number", defaultUnit: "%", label: "Y", required: true },
  cpx1: {
    type: "number",
    defaultUnit: "%",
    label: "Control Point X",
    required: true,
  },
  cpy1: {
    type: "number",
    defaultUnit: "%",
    label: "Control Point Y",
    required: true,
  },
  cp1Origin: {
    type: "select",
    options: ["start", "end", "origin"],
    label: "Control Point Relative To",
  },
  cpx2: {
    type: "number",
    defaultUnit: "%",
    label: "Control Point X 2",
    required: true,
  },
  cpy2: {
    type: "number",
    defaultUnit: "%",
    label: "Control Point Y 2",
    required: true,
  },
  cp2Origin: {
    type: "select",
    options: ["start", "end", "origin"],
    label: "Control Point 2 Relative To",
  },
  radiusX: {
    type: "number",
    defaultUnit: "px",
    label: "Radius X",
    required: true,
  },
  radiusY: {
    type: "number",
    defaultUnit: "px",
    label: "Radius Y",
    required: true,
  },
  rotate: { type: "number", defaultUnit: "deg", label: "Rotation" },
  size: { type: "select", options: ["small", "large"], label: "Size" },
  sweep: { type: "select", options: ["ccw", "cw"], label: "Direction" },
};

const COMMAND_CONFIG: Record<string, CommandConfig> = {
  from: {
    label: "From (Starting Point)",
    fields: ["fill-rule", "x", "y"],
  },
  line: {
    label: "Line",
    fields: ["x", "y"],
    hasRelative: true,
  },
  hline: {
    label: "Horizontal Line",
    fields: ["x"],
    hasRelative: true,
  },
  vline: {
    label: "Vertical Line",
    fields: ["y"],
    hasRelative: true,
  },
  "curve-quad": {
    label: "Curve (Quad)",
    fields: ["x", "y", "cpx1", "cpy1", "cp1Origin"],
    hasRelative: true,
  },
  "curve-cubic": {
    label: "Curve (Cubic)",
    fields: [
      "x",
      "y",
      "cpx1",
      "cpy1",
      "cp1Origin",
      "cpx2",
      "cpy2",
      "cp2Origin",
    ],
    hasRelative: true,
  },
  smooth: {
    label: "Smooth (Quad)",
    fields: ["x", "y"],
    hasRelative: true,
  },
  "smooth-cubic": {
    label: "Smooth (Cubic)",
    fields: ["x", "y", "cpx2", "cpy2", "cp2Origin"],
    hasRelative: true,
  },
  arc: {
    label: "Arc",
    fields: ["x", "y", "radiusX", "radiusY", "size", "sweep", "rotate"],
    hasRelative: true,
  },
  move: {
    label: "Move",
    fields: ["x", "y"],
    hasRelative: true,
  },
  close: {
    label: "Close Path",
    fields: [],
  },
};

const TIPS = [
  `Warning: <code>fill-rule</code> is not supported in <code>offset-path</code> and using it invalidates the property.`,
  `Tip: Drag the <em>Path History</em> if it is in the way. Or use it to edit, reorder, or delete your step values.<cite>
  <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/basic-shape/shape">
    [MDN]
  </a>
</cite>`,
  `Tip: Use custom units to use keywords like <code>center</code>, <code>start</code>, container query units, custom properties, or anchor positioning <code>calc(anchor(left) + 1rem)</code>`,
  `Tip: Apply the <code>shape()</code> function to <code>offset-path</code>, <code>clip-path</code>, or anywhere you want to define a path in plain English (versus path shorthand).`,
  `Tip: If your mobile keyboard isn't rendering a "-" to use negative values, choose <code>custom</code> unit and type your negative there. (e.g. <code>-10px</code>)`,
  `Tip: If a coordinate in a <code>&lt;coordinate-pair&gt;</code> is specified as a percentage, the value is calculated relative to the respective width or height of the reference box. <cite>
  <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/basic-shape/shape">
    [MDN]
  </a>
</cite>`,
  `Report bug or request feature <a href="mailto:edicodesigner+shape_generator@gmail.com">via email</a>. Find this projects <a target="_blank" href="https://github.com/clevermissfox/shape_generator">GitHub Repository</a>`,
];

const DEFAULT_UNIT_PREFERENCES: Record<string, string> = {
  x: "%",
  y: "%",
  cpx1: "%",
  cpy1: "%",
  cpx2: "%",
  cpy2: "%",
  radiusX: "px",
  radiusY: "px",
  rotate: "deg",
  coorOpt: "by",
};

const getSavedUnitPreferences = (): Record<string, string> => {
  if (typeof window === "undefined") return DEFAULT_UNIT_PREFERENCES;

  try {
    const stored = window.localStorage.getItem("shapeUnitPrefs");
    if (!stored) return DEFAULT_UNIT_PREFERENCES;
    return { ...DEFAULT_UNIT_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_UNIT_PREFERENCES;
  }
};

const getEventPoint = (
  event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
) => {
  if ("touches" in event && event.touches?.length) {
    return event.touches[0];
  }
  if ("changedTouches" in event && event.changedTouches?.length) {
    return event.changedTouches[0];
  }

  return event as MouseEvent;
};

const unitCheck = (step: PathStep, field: string) => {
  const value = step[field];
  const unit = step[`${field}_unit`];
  if (value === undefined || value === null || value === "") return "";
  const textValue = String(value);
  if (unit === "custom" || !unit) return textValue;
  return `${textValue}${unit}`;
};

/**
 * Determines the relative origin keyword for a control point.
 * Filters out the default 'start' value to keep the CSS output concise.
 * @param {Object} step - The current path step object.
 * @param {string} field - The specific origin field key (e.g., 'cp1Origin').
 * @returns {string} The formatted " from [keyword]" string or an empty string.
 */
function getOrigin(step: PathStep, field: string) {
  const val = step[field];
  return val && val !== "start" ? ` from ${val}` : "";
}

const formatStep = (step: PathStep) => {
  if (step.type === "from") {
    const isDefault = step["fill-rule"] === "nonzero";
    return `${isDefault ? "" : `${step["fill-rule"]} `}from ${unitCheck(step, "x")} ${unitCheck(step, "y")}`.trim();
  }

  if (step.type === "curve-quad") {
    return `curve ${step.coorOpt} ${unitCheck(step, "x")} ${unitCheck(step, "y")} with ${unitCheck(step, "cpx1")} ${unitCheck(step, "cpy1")}${getOrigin(step, "cp1Origin")}`.trim();
  }

  if (step.type === "curve-cubic") {
    return `curve ${step.coorOpt} ${unitCheck(step, "x")} ${unitCheck(step, "y")} with ${unitCheck(step, "cpx1")} ${unitCheck(step, "cpy1")}${getOrigin(step, "cp1Origin")} / ${unitCheck(step, "cpx2")} ${unitCheck(step, "cpy2")}${getOrigin(step, "cp2Origin")}`.trim();
  }

  if (step.type === "arc") {
    let result = `arc ${step.coorOpt || ""} ${unitCheck(step, "x")} ${unitCheck(step, "y")} of ${unitCheck(step, "radiusX")} ${unitCheck(step, "radiusY")}`;
    if (step.size === "large") result += " large";
    if (step.sweep === "cw") result += " cw";
    if (step.rotate && parseFloat(String(step.rotate)) !== 0) {
      result += ` rotate ${String(step.rotate)}${step.rotate_unit || ""}`;
    }
    return result.trim();
  }

  if (step.type.startsWith("smooth")) {
    if (step.cpx2) {
      return `smooth ${step.coorOpt} ${unitCheck(step, "x")} ${unitCheck(step, "y")} with ${unitCheck(step, "cpx2")} ${unitCheck(step, "cpy2")}${getOrigin(step, "cp2Origin")}`.trim();
    }
    return `smooth ${step.coorOpt || ""} ${unitCheck(step, "x")} ${unitCheck(step, "y")}`.trim();
  }

  const params = Object.entries(step)
    .filter(([key, value]) => {
      const excluded =
        ["type", "fill-rule"].includes(key) || key.endsWith("_unit");
      return !excluded && value != null && value !== "";
    })
    .map(([key]) => unitCheck(step, key))
    .filter(Boolean)
    .join(" ");

  return `${step.type} ${params}`.trim();
};

const sanitizeFieldValue = (value: string, unit: string) => {
  if (unit === "custom") return value;

  const cleaned = value
    .replace(/[^0-9.-]/g, "")
    .replace(/(?!^)-/g, "")
    .replace(/(\..*)\./g, "$1");
  if (unit === "%") {
    const parsed = parseFloat(cleaned);
    if (Number.isFinite(parsed)) {
      if (parsed > 100) return "100";
      if (parsed < -100) return "-100";
    }
  }
  return cleaned;
};

const App = () => {
  const [unitPreferences, setUnitPreferences] = useState<
    Record<string, string>
  >(getSavedUnitPreferences);
  const [pathState, setPathState] = useState<PathStep[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<string>("from");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formUnits, setFormUnits] = useState<Record<string, string>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const listWrapperRef = useRef<HTMLDetailsElement | null>(null);
  const carouselListRef = useRef<HTMLUListElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const offsetX = useRef(0);
  const offsetY = useRef(0);
  const wasOpen = useRef(false);
  const lastWidth = useRef(window.innerWidth);

  const currentCommandConfig = COMMAND_CONFIG[selectedCommand];

  const fieldKeys = currentCommandConfig.fields;

  const shapeExpression = useMemo(() => {
    if (pathState.length === 0) return "shape()";
    return `shape(${pathState.map(formatStep).join(", ")})`;
  }, [pathState]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--_shape-clip-path",
      pathState.length === 0 ? "none" : shapeExpression,
    );
  }, [pathState, shapeExpression]);

  useEffect(() => {
    const node = carouselListRef.current;
    if (!node) return;
    const interval = window.setInterval(() => {
      const nextX = node.scrollLeft + node.offsetWidth;
      node.scrollTo({
        left: nextX >= node.scrollWidth ? 0 : nextX,
        behavior: "smooth",
      });
    }, 6000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth === lastWidth.current) return;
      lastWidth.current = currentWidth;
      const wrapper = listWrapperRef.current;
      if (!wrapper) return;
      const currentX = parseInt(
        wrapper.style.getPropertyValue("--_list-wrapper-left") || "0",
        10,
      );
      const maxX = currentWidth - wrapper.offsetWidth;
      if (currentX > maxX) {
        wrapper.style.setProperty(
          "--_list-wrapper-left",
          `${Math.max(0, maxX)}px`,
        );
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      event.preventDefault();
      const point = getEventPoint(event);
      const newX = Math.max(
        0,
        Math.min(
          point.clientX - offsetX.current,
          window.innerWidth - (listWrapperRef.current?.offsetWidth ?? 0),
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          point.clientY - offsetY.current,
          window.innerHeight - (listWrapperRef.current?.offsetHeight ?? 0),
        ),
      );
      const wrapper = listWrapperRef.current;
      if (!wrapper) return;
      wrapper.style.setProperty("--_list-wrapper-left", `${newX}px`);
      wrapper.style.setProperty("--_list-wrapper-top", `${newY}px`);
      wrapper.style.setProperty("--_list-wrapper-right", "auto");
      wrapper.style.setProperty("--_list-wrapper-bottom", "auto");
    };

    const onEnd = (event: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const point = getEventPoint(event);
      const moved =
        Math.abs(point.clientX - startX.current) > 5 ||
        Math.abs(point.clientY - startY.current) > 5;
      if (moved) {
        window.setTimeout(() => {
          const wrapper = listWrapperRef.current;
          if (!wrapper) return;
          if (wasOpen.current) wrapper.setAttribute("open", "");
          else wrapper.removeAttribute("open");
        }, 0);
      }
      isDragging.current = false;
      const wrapper = listWrapperRef.current;
      if (wrapper) wrapper.style.cursor = "grab";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  const getFieldUnit = (fieldKey: string) => {
    return (
      formUnits[fieldKey] ??
      unitPreferences[fieldKey] ??
      FIELD_TYPES[fieldKey]?.defaultUnit ??
      ""
    );
  };

  const handleCommandChange = (value: string) => {
    setSelectedCommand(value);
    // setEditingIndex(null);
    setFormValues({});
    setFormUnits({});
  };

  const loadFormFromStep = (step: PathStep) => {
    const nextValues: Record<string, string> = {};
    const nextUnits: Record<string, string> = {};
    const config = COMMAND_CONFIG[step.type];

    if (config.hasRelative) {
      nextValues.coorOpt = step.coorOpt || unitPreferences.coorOpt || "by";
    }

    config.fields.forEach((fieldKey) => {
      nextValues[fieldKey] = String(step[fieldKey] ?? "");
      if (FIELD_TYPES[fieldKey]?.type === "number") {
        nextUnits[fieldKey] =
          step[`${fieldKey}_unit`] ??
          unitPreferences[fieldKey] ??
          FIELD_TYPES[fieldKey].defaultUnit ??
          "";
      }
    });

    setFormValues(nextValues);
    setFormUnits(nextUnits);
  };

  const handleEdit = (index: number) => {
    const step = pathState[index];
    if (!step) return;
    setSelectedCommand(step.type);
    setEditingIndex(index);
    loadFormFromStep(step);
  };

  const handlePathAction = (index: number, action: string) => {
    setPathState((prev) => {
      const next = [...prev];
      if (index === 0) {
        if (action === "delete" && prev.length === 1) {
          next.splice(index, 1);
          return next;
        }
        return prev;
      }

      if (action === "delete") {
        next.splice(index, 1);
        return next;
      }

      if (action === "up") {
        if (index <= 1) return prev;
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        return next;
      }

      if (action === "down" && index < next.length - 1) {
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        return next;
      }

      return prev;
    });
  };

  useEffect(() => {
    if (pathState.length === 0 && selectedCommand !== "from") {
      setSelectedCommand("from");
    }
  }, [pathState.length, selectedCommand]);

  const handleStartDrag = (
    event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  ) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    const wrapper = listWrapperRef.current;
    if (!wrapper) return;

    const point = getEventPoint(event);
    isDragging.current = true;
    startX.current = point.clientX;
    startY.current = point.clientY;
    wasOpen.current = wrapper.hasAttribute("open");
    offsetX.current = point.clientX - wrapper.getBoundingClientRect().left;
    offsetY.current = point.clientY - wrapper.getBoundingClientRect().top;
    wrapper.style.transition = "none";
    wrapper.style.cursor = "grabbing";
  };

  const handleInputChange = (fieldKey: string, value: string) => {
    const unit = getFieldUnit(fieldKey);
    const sanitized =
      FIELD_TYPES[fieldKey]?.type === "number"
        ? sanitizeFieldValue(value, unit)
        : value;
    setFormValues((prev) => ({ ...prev, [fieldKey]: sanitized }));
  };

  const handleUnitChange = (fieldKey: string, unit: string) => {
    setFormUnits((prev) => ({ ...prev, [fieldKey]: unit }));
    if (fieldKey in formValues) {
      setFormValues((prev) => ({ ...prev, [fieldKey]: prev[fieldKey] ?? "" }));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = COMMAND_CONFIG[selectedCommand];
    const missingRequired = command.fields.some((fieldKey) => {
      const fieldConfig = FIELD_TYPES[fieldKey];
      if (!fieldConfig?.required) return false;
      return !formValues[fieldKey]?.trim().length;
    });

    if (missingRequired) {
      window.alert("Please fill in all required fields.");
      return;
    }

    const newEntry: PathStep = { type: selectedCommand };
    if (command.hasRelative) {
      newEntry.coorOpt = formValues.coorOpt || unitPreferences.coorOpt || "by";
    }

    command.fields.forEach((fieldKey) => {
      const fieldConfig = FIELD_TYPES[fieldKey];
      const rawValue = formValues[fieldKey] ?? "";
      if (rawValue.trim().length) {
        newEntry[fieldKey] = rawValue.trim();
        if (fieldConfig?.type === "number") {
          newEntry[`${fieldKey}_unit`] =
            formUnits[fieldKey] ??
            unitPreferences[fieldKey] ??
            fieldConfig.defaultUnit ??
            "";
        }
      } else {
        if (fieldKey === "fill-rule") {
          newEntry["fill-rule"] = "nonzero";
        } else {
          newEntry[fieldKey] = null;
        }
      }
    });

    const updated = [...pathState];
    if (editingIndex !== null) {
      updated[editingIndex] = newEntry;
      setEditingIndex(null);
    } else {
      updated.push(newEntry);
      const savedValues: Record<string, string> = { ...unitPreferences };
      command.fields.forEach((fieldKey) => {
        if (fieldKey in formUnits) {
          savedValues[fieldKey] = formUnits[fieldKey];
        }
      });
      if (command.hasRelative) {
        savedValues.coorOpt = newEntry.coorOpt || savedValues.coorOpt;
      }
      setUnitPreferences(savedValues);
      window.localStorage.setItem(
        "shapeUnitPrefs",
        JSON.stringify(savedValues),
      );
    }

    setPathState(updated);
    setFormValues({});
    setFormUnits({});
    if (selectedCommand === "from") {
      setSelectedCommand("line");
    }
  };

  const handleReset = () => {
    setPathState([]);
    setSelectedCommand("from");
    setEditingIndex(null);
    setFormValues({});
    setFormUnits({});
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shapeExpression);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      window.alert("Unable to copy to clipboard.");
    }
  };

  const commandOptions = Object.entries(COMMAND_CONFIG).map(([key, config]) => {
    const disabled = pathState.length === 0 ? key !== "from" : key === "from";
    return (
      <option key={key} value={key} disabled={disabled}>
        {config.label}
      </option>
    );
  });

  return (
    <div className="wrapper padding-b-2">
      <header>
        <h1>
          <code>shape()</code>generator
        </h1>
      </header>

      <div className="card container size">
        <div className="shape" aria-hidden="true" />
        <div className="output-wrapper">
          <output className="grow-1" id="output">
            <code>{shapeExpression}</code>
          </output>
          <button
            type="button"
            className="btn btn-primary padding-quarter padding-i-half margin-is-auto"
            id="btn-copy-path"
            aria-label={
              copyStatus === "copied" ? "Copied!" : "Copy shape function"
            }
            onClick={copyText}
          >
            <i
              className={`fas ${copyStatus === "copied" ? "fa-check" : "fa-copy"}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div className="controls container">
        <form
          className="controls-wrapper"
          id="controls-wrapper"
          onSubmit={handleSubmit}
        >
          <label className="custom-select">
            <span className="label">Command</span>
            <select
              id="select-command"
              value={selectedCommand}
              disabled={editingIndex === 0}
              onChange={(event) => handleCommandChange(event.target.value)}
            >
              {commandOptions}
            </select>
          </label>

          {currentCommandConfig.hasRelative ? (
            <label className="custom-select">
              <span className="label">Strategy</span>
              <select
                id="select-coor-opt"
                value={formValues.coorOpt ?? unitPreferences.coorOpt}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    coorOpt: event.target.value,
                  }))
                }
                data-field="coorOpt"
              >
                {COOR_OPTS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {fieldKeys.map((fieldKey) => {
            const fieldConfig = FIELD_TYPES[fieldKey];
            if (!fieldConfig) return null;
            const fieldValue = formValues[fieldKey] ?? "";
            const currentUnit = getFieldUnit(fieldKey);

            if (fieldConfig.type === "select") {
              return (
                <label className="custom-select" key={fieldKey}>
                  <span className="label">{fieldConfig.label}</span>
                  <select
                    value={fieldValue || fieldConfig.options?.[0] || ""}
                    onChange={(event) =>
                      setFormValues((prev) => ({
                        ...prev,
                        [fieldKey]: event.target.value,
                      }))
                    }
                    data-field={fieldKey}
                  >
                    {(fieldConfig.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            const isCustom = currentUnit === "custom";
            return (
              <div className="input-wrapper row gap-half ai-end" key={fieldKey}>
                <label className="custom-input">
                  <span className="label">{fieldConfig.label}</span>
                  <input
                    data-field={fieldKey}
                    type="text"
                    placeholder={
                      isCustom ? "center" : currentUnit === "%" ? "50" : "20"
                    }
                    inputMode={isCustom ? "text" : "numeric"}
                    pattern={isCustom ? undefined : "-?[0-9.]*"}
                    value={fieldValue}
                    required={fieldConfig.required}
                    aria-required={fieldConfig.required ? "true" : undefined}
                    onChange={(event) =>
                      handleInputChange(fieldKey, event.target.value)
                    }
                  />
                </label>
                {fieldConfig.type === "number" ? (
                  <label className="custom-select">
                    <span className="label visually-hidden">Unit</span>
                    <select
                      className="select-unit"
                      value={currentUnit}
                      onChange={(event) =>
                        handleUnitChange(fieldKey, event.target.value)
                      }
                    >
                      {(fieldKey === "rotate" ? ["deg"] : UNITS).map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            );
          })}

          <button
            id="btn-add_path"
            className="btn btn-accent btn-add_path"
            type="submit"
          >
            {editingIndex !== null ? "Update Step" : "Add to Path"}
          </button>
          <button
            id="btn-reset"
            className="btn btn-primary btn-reset"
            type="button"
            onClick={handleReset}
          >
            Reset
          </button>
        </form>
      </div>

      <aside
        className="carousel-wrapper warning surface-primary border-default padding-1 br-default container"
        role="note"
      >
        <ul role="list" ref={carouselListRef}>
          {TIPS.map((tip, index) => (
            <li
              key={index}
              className="ta-cen"
              dangerouslySetInnerHTML={{ __html: tip }}
            />
          ))}
        </ul>
      </aside>

      <details className="list-wrapper" id="list-wrapper" ref={listWrapperRef}>
        <summary onMouseDown={handleStartDrag} onTouchStart={handleStartDrag}>
          Path history
        </summary>
        <ul className="path-list" id="path-list" role="list">
          {pathState.length === 0 ? (
            <li>No History</li>
          ) : (
            pathState.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === pathState.length - 1;
              return (
                <li
                  className={`path-item${editingIndex === index ? " action_edit" : ""} padding-b-half`}
                  key={index}
                >
                  <span
                    dangerouslySetInnerHTML={{ __html: formatStep(item) }}
                  />
                  <div className="actions row gap-quarter">
                    <button
                      className="btn-action small"
                      type="button"
                      data-action="up"
                      aria-label="Action: Move Up"
                      title="Action: Move Up"
                      disabled={isFirst || index === 1}
                      onClick={() => handlePathAction(index, "up")}
                    >
                      <i className="fas fa-arrow-up" aria-hidden="true" />
                    </button>
                    <button
                      className="btn-action small"
                      type="button"
                      data-action="down"
                      aria-label="Action: Move Down"
                      title="Action: Move Down"
                      disabled={isLast || isFirst}
                      onClick={() => handlePathAction(index, "down")}
                    >
                      <i className="fas fa-arrow-down" aria-hidden="true" />
                    </button>
                    <button
                      className="btn-action small"
                      type="button"
                      data-action="edit"
                      aria-label="Action: Edit Path"
                      title="Action: Edit Path"
                      onClick={() => handleEdit(index)}
                    >
                      <i className="fas fa-pen-to-square" aria-hidden="true" />
                    </button>
                    <button
                      className="btn-action small"
                      type="button"
                      data-action="delete"
                      aria-label="Action: Delete Path"
                      title="Action: Delete Path"
                      disabled={isFirst && pathState.length > 1}
                      onClick={() => handlePathAction(index, "delete")}
                    >
                      <i className="fas fa-xmark" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </details>
    </div>
  );
};

export default App;
