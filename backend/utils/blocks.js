import Block from "../models/Block.js";

const sameId = (a, b) => String(a) === String(b);

// Block state between the current user and ONE other user.
export async function getBlockState(meId, otherId) {
  const rows = await Block.find({
    $or: [
      { blocker: meId, blocked: otherId },
      { blocker: otherId, blocked: meId },
    ],
  })
    .select("blocker")
    .lean();

  return {
    blockedByMe: rows.some((row) => sameId(row.blocker, meId)),
    blockedByOther: rows.some((row) => !sameId(row.blocker, meId)),
  };
}

// Same, for many users at once (one query). Returns Map(otherId -> state).
export async function getBlockStates(meId, otherIds) {
  const states = new Map();

  for (const id of otherIds) {
    states.set(String(id), { blockedByMe: false, blockedByOther: false });
  }

  if (!otherIds.length) return states;

  const rows = await Block.find({
    $or: [
      { blocker: meId, blocked: { $in: otherIds } },
      { blocker: { $in: otherIds }, blocked: meId },
    ],
  })
    .select("blocker blocked")
    .lean();

  for (const row of rows) {
    if (sameId(row.blocker, meId)) {
      const state = states.get(String(row.blocked));
      if (state) state.blockedByMe = true;
    } else {
      const state = states.get(String(row.blocker));
      if (state) state.blockedByOther = true;
    }
  }

  return states;
}

// Returns an error message if this user may NOT message in this conversation
// because of a block, otherwise null. Groups are never affected.
// `conversation.participants` may hold ids or populated users.
export async function getBlockedMessage(conversation, userId) {
  if (!conversation || conversation.type !== "private") return null;

  const other = (conversation.participants || []).find(
    (participant) => !sameId(participant?._id || participant, userId)
  );

  if (!other) return null;

  const { blockedByMe, blockedByOther } = await getBlockState(
    userId,
    other._id || other
  );

  if (blockedByMe) {
    return "You blocked this contact. Unblock them to send messages.";
  }

  if (blockedByOther) {
    return "You can't send messages to this contact.";
  }

  return null;
}