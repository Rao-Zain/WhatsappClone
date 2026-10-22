export function hasOnlineRecipient(io, conversation, senderId) {
  return conversation.participants.some((participantId) => {
    if (String(participantId) === String(senderId)) return false;

    const room = io?.sockets?.adapter?.rooms?.get(
      `user:${String(participantId)}`
    );

    return Boolean(room?.size);
  });
}
