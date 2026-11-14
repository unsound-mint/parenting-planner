import "./illustrations.css";

/* Plain prefixed class names; CSS modules do not work with this repo's
   turbopack css rule, so the stylesheet is global and prefixed. */
const styles = {
  stage: "pp-ill-stage",
  bob: "pp-ill-bob",
  tap: "pp-ill-tap",
  svg: "pp-ill-svg",
  eyes: "pp-ill-eyes",
  heart: "pp-ill-heart",
  bubble: "pp-ill-bubble",
  bubbleOn: "pp-ill-bubble-on",
} as const;

export default styles;
