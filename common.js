function get_time_string(value) {
    return value/1000/60;
}
  
/**
 * Create notification
 * 
 * @param {Date} end_date Ending Date
 * @param {integer} notify_ahead_seconds Number of seconds to be notified before the session expire
 */
function create_notification(session_id, end_date, notify_ahead_seconds) {
    var now = new Date();
  
    // Enable notification when expires in the future
    var diff_ms = (end_date.getTime() - now.getTime()) / 1000;
  
    if (diff_ms > 0) {
      var title = 'A sua sessão expira em ' + notify_ahead_seconds + ' segundos!';
      var message = 'A sua sessão vai expirar brevemente!';
      if (notify_ahead_seconds == 0) {
        title = 'A sua sessão expirou!';
        message = 'A sua sessão na Via Verde - Estacionar expirou!';
      }
  
      if (diff_ms - notify_ahead_seconds > 0) {
        var key = session_id + "_" + notify_ahead_seconds;
        
        // Check if notifications was already set
        if (notifications[key] === undefined) {
          notifications[key] = {
            expire_date: end_date.getTime(),
            notify_ahead_seconds: notify_ahead_seconds,
            title: title, 
            message: message
          };
  
          alarm_time = end_date.getTime() - notify_ahead_seconds * 1000;
          chrome.alarms.create(key, {when: alarm_time});
          alarm_time_date = new Date(alarm_time);

          console.log("Create notification for Session ID [" + session_id + "] for " + alarm_time_date.toLocaleString());
        }
  
        // Clean expired sessions
        for (var key in notifications) {
            if (notifications.hasOwnProperty(key)) {
                var real_notification_time = notifications[key].expire_date - notifications[key].notify_ahead_seconds;
                if (real_notification_time < now.getTime()) {
                    delete notifications[key];
                }
            }
        }
  
        chrome.storage.sync.set({notifications: notifications});
      }
    }
  }

// onAlarm is better than setTimeout.
chrome.alarms.onAlarm.addListener(function(alarm) {
    if (notifications[alarm.name] !== undefined) {
        chrome_notifications_object = {
            title: notifications[alarm.name].title,
            message: notifications[alarm.name].message,
            type: 'basic',
            iconUrl: 'icon_128.png',
            requireInteraction: false,
            buttons: [
                {title: "Mais 2 horas!"},
                {title: "Até fim do dia!"},
            ]
        };

        // Only when it expires, it keep always on top until user close it.
        if (notifications[alarm.name].notify_ahead_seconds == 0) {
            chrome_notifications_object.requireInteraction = true;
        }

        chrome.notifications.create(alarm.name, chrome_notifications_object);
    }
});