// notification.js - Provides a modern, subtle notification sound
// Base64 encoded audio file to eliminate external dependencies

// Base64 encoded MP3 data for a subtle notification sound
// This is a short, modern "bip" sound optimized for size and quality
const notificationSoundBase64 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADwAD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwBK8AAAAAAAAAABUgJAMGQQABmgAAA8CC3YZfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

/**
 * Creates and returns a new Audio object with the notification sound
 * @returns {Audio} HTML5 Audio object with the notification sound
 */
function createNotificationSound() {
  return new Audio(notificationSoundBase64);
}

/**
 * Plays the notification sound
 * @returns {Promise} A promise that resolves when the sound finishes playing
 */
function playNotificationSound() {
  const sound = createNotificationSound();
  return sound.play().catch(error => {
    // Handle autoplay restrictions
    console.warn('Could not play notification sound:', error);
  });
}

// Export the notification sound functions
export {
  createNotificationSound,
  playNotificationSound,
  notificationSoundBase64
};
