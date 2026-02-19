import React from "react";

export type ActionState = {
  status: "idle" | "loading" | "success" | "error";
  title: string;
  payload?: unknown;
};

export function SectionResult({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <div className={`section-result ${state.status}`}>
      <strong>{state.title}</strong>
      {state.payload ? <pre>{JSON.stringify(state.payload, null, 2)}</pre> : null}
    </div>
  );
}
