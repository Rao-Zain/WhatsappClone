// Short text used when a message is quoted (reply preview / quoted block).
export function getPreviewLabel({ text, type, deleted, fileName }) {
  if (deleted) return "This message was deleted";
  if (text) return text;

  switch (type) {
    case "image":
      return "📷 Photo";
    case "video":
      return "🎥 Video";
    case "voice":
      return "🎤 Voice message";
    case "audio":
      return "🎧 Audio";
    case "document":
    case "file":
      return fileName ? `📄 ${fileName}` : "📄 Document";
    default:
      return "Message";
  }
}