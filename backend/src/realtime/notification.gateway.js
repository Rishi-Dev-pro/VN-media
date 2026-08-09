const User = require('../models/User');
const { getIO } = require('./socket');
const { sanitizePublicUser } = require('../services/user.service');

/**
 * Deliver a newly created, persisted Notification in real-time to the recipient's socket room.
 *
 * @param {object} notification - Mongoose Notification document or formatted object
 */
const deliverNotification = async (notification) => {
  if (!notification) {
    return;
  }

  const io = getIO();
  if (!io) {
    return;
  }

  const recipientId = notification.recipientId
    ? notification.recipientId.toString()
    : null;

  if (!recipientId) {
    return;
  }

  let formattedActor = null;
  if (notification.actor) {
    formattedActor = notification.actor;
  } else if (notification.actorId && typeof notification.actorId === 'object' && notification.actorId.username) {
    formattedActor = sanitizePublicUser(notification.actorId);
  } else if (notification.actorId) {
    const actorUser = await User.findById(notification.actorId);
    if (actorUser) {
      formattedActor = sanitizePublicUser(actorUser);
    }
  }

  const payload = {
    id: notification._id ? notification._id.toString() : (notification.id || null),
    type: notification.type,
    actor: formattedActor,
    targetType: notification.targetType,
    targetId: notification.targetId ? notification.targetId.toString() : null,
    metadata: notification.metadata || {},
    readAt: notification.readAt || null,
    createdAt: notification.createdAt || new Date().toISOString(),
  };

  // Deliver real-time notification strictly to the recipient's room
  io.to(`user:${recipientId}`).emit('notification:new', payload);
};

module.exports = {
  deliverNotification,
};
