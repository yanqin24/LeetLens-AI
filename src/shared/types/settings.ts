export type Settings = {
  autoCaptureFailedSubmissions: boolean;
  showInPagePanel: boolean;
  defaultReviewEnabled: boolean;
  exportFormat: "json" | "markdown";
};

export const defaultSettings: Settings = {
  autoCaptureFailedSubmissions: true,
  showInPagePanel: true,
  defaultReviewEnabled: true,
  exportFormat: "json"
};
