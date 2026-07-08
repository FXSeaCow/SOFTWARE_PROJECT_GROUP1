const env = require('./config/env');
const app = require('./app');
const { startNotificationScheduler } = require('./modules/notifications/notification.scheduler');

const PORT = env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    if (process.env.ENABLE_NOTIFICATION_SCHEDULER !== 'false') {
      startNotificationScheduler();
    }
  });
}

module.exports = app;
