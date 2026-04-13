const safe = (v, fallback = "") => (v == null ? fallback : String(v));

export const buildNotificationTemplate = (type, data = {}) => {
  switch (type) {
    case "decision":
      return {
        title: "Paper Decision Published",
        message: `Your paper "${safe(data.paperTitle, "Untitled Paper")}" was ${safe(data.status, "updated")}.`,
        emailSubject: `[ConfFlow] Decision: ${safe(data.paperTitle, "Paper")}`,
        emailBody: `Hello,\n\nA decision has been published for "${safe(data.paperTitle, "your paper")}".\nStatus: ${safe(data.status, "updated")}\nNote: ${safe(data.decisionNote, "No note provided.")}\n\n- ConfFlow`
      };
    case "camera-ready":
      return {
        title: "Camera-ready Submitted",
        message: `Camera-ready version submitted for "${safe(data.paperTitle, "Untitled Paper")}".`,
        emailSubject: `[ConfFlow] Camera-ready submitted`,
        emailBody: `Hello,\n\nThe camera-ready version has been submitted for "${safe(data.paperTitle, "a paper")}".\nSubmitted by: ${safe(data.authorId, "author")}\n\n- ConfFlow`
      };
    case "review-assigned":
      return {
        title: "New Review Assignment",
        message: `You were assigned to review "${safe(data.paperTitle, "a paper")}".`,
        emailSubject: `[ConfFlow] New review assignment`,
        emailBody: `Hello Reviewer,\n\nYou have been assigned to review "${safe(data.paperTitle, "a paper")}".\nDue date: ${safe(data.dueDate, "TBD")}\n\n- ConfFlow`
      };
    default:
      return {
        title: "ConfFlow Update",
        message: "There is an update in your conference workflow.",
        emailSubject: "[ConfFlow] Update",
        emailBody: "Hello,\n\nThere is an update in your ConfFlow workflow.\n\n- ConfFlow"
      };
  }
};
