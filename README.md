# Shape Generator

This repo contains a shape() function generator for writing CSS `clip-path` and `offset-path` values without hand-coding complex path syntax.

Every generated shape must start with the `from` command, which defines the starting point of the path. After `from`, you can add additional commands such as `line to`, `vline by`, `hline by`, and `arc`.

Use `to` for absolute coordinates, and `by` for relative coordinates.

See the most up to date documentation on [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/basic-shape/shape).

## How it works

- Use the generator UI to build a `shape()` expression.
- The app outputs valid CSS for `clip-path` and `offset-path`.
- Generated shapes can be copied into your stylesheet.

## Supported syntax

A shape function begins with `shape(` and must include `from` first.

Example:

```css
clip-path: shape(
  from 0 0,
  line by 10px 1rem,
  vline by 1vw,
  arc to 100% 50% of 20px 20px large cw rotate 45deg,
  close
);
```

### Commands

- `from x y`
  - Start a new path at coordinates `x` and `y`.
  - You can also prefix the first command with `evenodd` or `nonzero`(default) to set the fill rule.
- `line <to | by> x y`
  - Draw a straight line
- `hline <to | by> x`
  - Horizontal line
- `vline <to | by> y`
  - Vertical line
- `curve to x y with cpx1 cpy1`
  - Quadratic curve using a single control point.
- `curve to x y with cpx1 cpy1 / cpx2 cpy2`
  - Cubic curve using two control points.
- `smooth to x y`
  - Smooth quadratic curve to the point.
- `smooth to x y with cpx2 cpy2`
  - Smooth cubic curve to the point using a second control point.
- `arc to x y of radiusX radiusY [large] [cw] [rotate angle]`
  - Draw an arc to the point with the given radii.
- `move to x y`
  - Move the current point without drawing.
- `close`
  - Close the current path.

### `from` and `fill-rule`

- `from` must be the first command.
- The default fill rule is `nonzero`.
- `fill-rule` is supported only on `clip-path` / fill-based shapes.
- `fill-rule` is not valid in `offset-path`; using it in `offset-path` can invalidate the value.

## Units and values

The generator supports a mix of units:

- Absolute units: `px`, `rem`, `em`, `%`, `vw`, `vh`, `vmin`, `vmax`
- `custom`
  - Select `custom` from the unit dropdown and type any value directly into the input.
  - This is the right way to use custom properties, logical units, container query expressions, keywords like `center` or `start`, anchor positioning, or unfamiliar units.
  - Example values: `--my-offset`, `calc(100% - 1rem)`, `anchor(left)`, `50dppx`, `-10px`

### Examples

```css
shape(from 0 0, line by 10px 1rem, vline by 1vw, hline by 2vmin, line to 50% 25%);
```

```css
offset-path: shape(from 0 0, line to 100px 0, line to 100px 100px, close);
```

## Important CSS notes

- `clip-path` accepts `shape()` values in browsers that support CSS Shapes Level 2 syntax.
- `offset-path` also accepts `shape()` values, but `fill-rule` is not valid there.
- For `offset-path`, use a path definition appropriate for motion paths rather than fill-based boundary shapes.

## Project setup

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project structure

- `index.html` — app entry HTML
- `src/main.tsx` — React app bootstrap
- `src/App.tsx` — main component
- `style.css` — global styles
- `vite.config.ts` — Vite config
- `tsconfig.json` / `tsconfig.node.json` — TypeScript settings
