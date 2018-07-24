var api = new API();
var config = {};
var notifications = {};

// Setup notification button actions
chrome.notifications.onButtonClicked.addListener(function(notificationKey, btnIdx) {
  for (var key in notifications) {
    if (notifications.hasOwnProperty(key)) {
      if (notificationKey === key) {
        if (btnIdx === 0) {
          // TODO: Plus two hours
          console.log("Add two more hours!");
          alert("Não implementado!");
        } else if (btnIdx === 1) {
          // TODO: Until end of the day
          console.log("Until end of the day!");
          alert("Não implementado!");
        }
      }
    }
  }
});

// On Toolbar click, open options
chrome.browserAction.onClicked.addListener(function(activeTab){
  chrome.tabs.create({ url: "chrome-extension://" + chrome.runtime.id + "/options.html"});
});

chrome.storage.sync.get(['config', 'notifications'], function(items) {
  // Check if credentials are set
  if (items.config !== undefined) {
    // Copy config
    config = items.config;

    if (items.config.email !== undefined && items.config.password !== undefined) {
      console.log("Login with [" + items.config.email + "]");

      // Login and get active sessions
      api.login(items.config.email, items.config.password, function(){
        // With success

        // Get active sessions
        api.getSessions("ACTIVE", function(response) {
          for (var i = 0; i < response.length; i++) {
            var minutes = get_time_string(response[i].cost_time_pair.duration_ms);
            var start_date = new Date(response[i].dtstart.date);
            var end_date = new Date(start_date.getTime() + minutes * 60 * 1000);
            
            create_notification(response[i], end_date, 0);
            create_notification(response[i], end_date, 5*60); // 5m before
          }
        });
      });
    }
  }

  if (items.notifications !== undefined) {
    notifications = items.notifications;
  }
});

// Sync options
chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (changes.config !== undefined) {
    config = changes.config.newValue;
  }
  
  if (changes.notifications !== undefined) {
    notifications = changes.notifications.newValue;
  }
});

function check_active_sessions() {
  // Get active sessions
  api.getSessions("ACTIVE", function(response) {
    for (var i = 0; i < response.length; i++) {
      var minutes = get_time_string(response[i].cost_time_pair.duration_ms);
      var start_date = new Date(response[i].dtstart.date);
      var end_date = new Date(start_date.getTime() + minutes * 60 * 1000);
      
      create_notification(response[i], end_date, 0);
      create_notification(response[i], end_date, 5*60);
    }
  });

  setTimeout(check_active_sessions, 5 * 60 * 1000);
}

// Check every 5 minutes
setTimeout(check_active_sessions, 5 * 60 * 1000);