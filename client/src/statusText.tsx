import { Fragment } from "react";

// Lets a status like WAITING_FOR_REQUESTER wrap after an underscore in a narrow table cell; the text itself is unchanged.
export function breakAtUnderscores(value: string) {
  return value.split("_").map((part, index, parts) => (
    <Fragment key={index}>{part}{index < parts.length - 1 && <>_<wbr /></>}</Fragment>
  ));
}
