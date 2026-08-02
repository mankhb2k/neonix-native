type Props = {
  zoom: number;
  zoomMode: "manual" | "fit";
  disabled?: boolean;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
};

export function TimelineZoomControls({
  zoom,
  zoomMode,
  disabled,
  onZoomChange,
  onFit,
}: Props) {
  return (
    <div className="timeline-zoom">
      <label className="timeline-zoom__label">
        Zoom
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={zoom}
          disabled={disabled}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          aria-label="Timeline zoom"
        />
        <span className="timeline-zoom__value">
          {Math.round(zoom)}
          {zoomMode === "fit" ? " · fit" : ""}
        </span>
      </label>
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={onFit}
        title="Fit timeline to viewport"
      >
        Fit
      </button>
    </div>
  );
}
