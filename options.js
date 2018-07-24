var config;
var notifications = {};

var municipal_services = new Array();
var municipal_zones = new Array();

var active_session, promise_token;

/**
TODO:
- Load position database to localstorage
*/

function get_time_string(value) {
  return value/1000/60;
}

/**
 * This is prone to XSS! TODO: Validate
 */
function create_session_card(session) {
  var div = document.createElement("div");
  div.setAttribute('data-id', session.token);
  div.setAttribute('class', 'session_card');

  var inner_left_div = document.createElement("div");
  inner_left_div.setAttribute('style', 'float: left');

  var ul = document.createElement("ul");
  ul.setAttribute('style', 'list-style: none; margin: 0px; padding: 0px; line-height: 20px;');

  var minutes = get_time_string(session.cost_time_pair.duration_ms);
  var start_date = new Date(session.dtstart.date);
  var end_date = new Date(start_date.getTime() + minutes * 60 * 1000);
  var now = new Date();
  
  // TODO: Check if exists notification setup

  var li_1_start = document.createElement("li");
  li_1_start.innerHTML = 'Início: <b>' + start_date.toLocaleString() + '</b>';
  var li_1_end = document.createElement("li");
  li_1_end.innerHTML = 'Fim: <b>' + end_date.toLocaleString() + '</b>';
  var li_2 = document.createElement("li");
  li_2.innerHTML = 'Matrícula: <b>' + session.plate.id + '</b>';
  var li_3 = document.createElement("li");
  li_3.setAttribute('style', 'padding-top: 10px;');
  li_3.innerHTML = 'Zona: <b title="' + session.position_token + '">' + municipal_zones[session.position_token].name + '</b>';
  var li_4 = document.createElement("li");
  li_4.innerHTML = 'Preço: <b>' + session.cost_time_pair.cost + ' €</b> para <b>' + minutes + ' minutos</b>';

  ul.appendChild(li_1_start);
  ul.appendChild(li_1_end);
  ul.appendChild(li_2);
  ul.appendChild(li_3);
  ul.appendChild(li_4);

  inner_left_div.appendChild(ul);
  div.appendChild(inner_left_div);

  // Map
  if (session.coordinates !== undefined && session.coordinates !== null && session.coordinates.length == 2) {
    latitude = session.coordinates[1];
    longitude = session.coordinates[0];

    img = document.createElement("img");
    img.setAttribute('style', 'float: right;');
    img.setAttribute('src', 'https://maps.googleapis.com/maps/api/staticmap?markers=color:red|' + latitude + ',' + longitude + '&zoom=16&scale=1&size=200x130&maptype=roadmap&format=png&visual_refresh=true')
    div.appendChild(img);
  }
  var div_clear_both = document.createElement("div");
  div_clear_both.setAttribute('style', 'clear: both');

  div.appendChild(div_clear_both);

  return div;
}

var api = new API();

function login() {
  email = document.getElementById('email').value;
  password = document.getElementById('password').value;

  if (password == "default_password") {
    password = config.password;
  }

  config.email = email;
  config.password = password;

  chrome.storage.sync.set({config: config}, function () {
    // Show that config was updated!
  });

  api.login(config.email, config.password, function() {
    // Load Vehicles
    get_vehicles();

    // Load sessions
    get_active_sessions();
    get_closed_sessions();

    document.getElementById("account_id").innerHTML = api.getAccountToken();
  }, function() {
    alert('Login error!');
  });
}

function get_vehicles() {
  api.getVehicles(function(response) {
    var vehicles_html = document.getElementById("vehicles");
  
    // Remove childs
    while (vehicles_html.childElementCount > 0) {
        vehicles_html.removeChild(vehicles_html.firstChild);
    }

    // Insert new childs
    for (var i = 0; i < response.length; i++) {
        var option = document.createElement("option");
        option.innerHTML = response[i].number;
        option.setAttribute('value', response[i].number);
        vehicles_html.appendChild(option);
    }
  });
}

function get_active_sessions() {
  api.getSessions("ACTIVE", function(response) {
    var active_sessions_html = document.getElementById("active_sessions_list");
  
    // Remove childs
    while (active_sessions_html.childElementCount > 0) {
        active_sessions_html.removeChild(active_sessions_html.firstChild);
    }

    var max = 10;
    if (max > response.length) {
      max = response.length;
    }

    // Insert new childs
    var selected = false;
    for (var i = 0; i < max; i++) {
      var div = create_session_card(response[i]);
      active_sessions_html.appendChild(div);

      // Select last current active session
      if (!selected) {
        selected = true;

        var zones_html = document.getElementById("zones");
        for(var j = 0; j < zones_html.length; j++) {
          if (zones_html[j].getAttribute('value') == response[i].position_token) {
            zones_html[j].setAttribute('selected', '');
            active_session = response[i];
          }
        }
      }
    }

    // Check and create notifications
    for (var i = 0; i < response.length; i++) {
      var minutes = get_time_string(response[i].cost_time_pair.duration_ms);
      var start_date = new Date(response[i].dtstart.date);
      var end_date = new Date(start_date.getTime() + minutes * 60 * 1000);
      
      create_notification(response[i].token, end_date, 0);
      create_notification(response[i].token, end_date, 5*60);
    }
  });
}

function get_closed_sessions() {
  api.getSessions("CLOSED", function(response) {
    var active_sessions_html = document.getElementById("past_sessions_list");
  
    // Remove childs
    while (active_sessions_html.childElementCount > 0) {
        active_sessions_html.removeChild(active_sessions_html.firstChild);
    }

    var max = 10;
    if (max > response.length) {
      max = response.length;
    }

    // Insert new childs
    for (var i = 0; i < max; i++) {
        var div = create_session_card(response[i]);
        active_sessions_html.appendChild(div);
    }
  });
}

chrome.storage.sync.get(['config', 'disclaimer', 'notifications'], function(items) {
  if(items.notifications !== undefined) {
    notifications = items.notifications;
  }
  
  if (items.config !== undefined) {
    config = items.config;

    // Load login initial values if avaiable
    if (config.account_token !== undefined && config.user_session_token !== undefined)  {
      api.setAccountToken(config.account_token);
      api.setUserSessionToken(config.user_session_token);
    }

    // Setup user credentials
    if (config.email !== undefined && config.password !== undefined) {
      document.getElementById('email').value = config.email;
      document.getElementById('password').value = config.password;

      // Login
      login();
    }
  }

  if (items.disclaimer == true) {
    document.getElementById("disclaimer").setAttribute('style', 'display: none;');
    document.getElementById("settings").setAttribute('style', 'display: block;');
  }

  api.getAllMunicipal(function(response) {
    if (response.result !== undefined) {
      municipal_services = response.result;

      var municipal_html = document.getElementById("municipal");

      // Remove childs
      while (municipal_html.childElementCount > 0) {
          municipal_html.removeChild(municipal_html.firstChild);
      }

      // Insert new childs
      for (var i = 0; i < response.result.length; i++) {
          var option = document.createElement("option");
          option.setAttribute("value", i);
          if (config.municipal_token == response.result[i].token) {
            option.setAttribute("selected", "");

            // Fetch results
            api.getMunicipal(config.municipal_token, load_municipal_zones);
          }
          option.innerHTML = response.result[i].name;
          municipal_html.appendChild(option);
      }
    }
  });
});

function load_municipal_zones(response) {
  municipal_zones = new Array();
  
  var zones_html = document.getElementById("zones");

  // Remove childs
  while (zones_html.childElementCount > 0) {
    zones_html.removeChild(zones_html.firstChild);
  }

  // Insert new childs
  for (var i = 0; i < response.result.length; i++) {
    var id = response.result[i].token; // context_token
    municipal_zones[id] = {
      name: response.result[i].name,
      color: response.result[i].color
    }

    var option = document.createElement("option");
    // TODO: Get last session zone.
    if (false) {
      option.setAttribute('selected', '');
    }
    option.setAttribute('value', id);
    option.innerHTML = response.result[i].name;
    zones_html.appendChild(option);
  }
}

/**
 * Get parking zones from a Municipal zone
 */
function get_municipal_information() {
  municipal_info = municipal_services[document.getElementById('municipal').value]
  api.getMunicipal(municipal_info.token, load_municipal_zones);

  // Save municipal token on settings
  config.municipal_token = municipal_info.token;
  chrome.storage.sync.set({config: config});
}

function agree() {
  document.getElementById("disclaimer").setAttribute('style', 'display: none;');
  document.getElementById("settings").setAttribute('style', 'display: block;');
  chrome.storage.sync.set({disclaimer: true});
}

function donotagree() {
  chrome.storage.sync.set({disclaimer: false});
}

function start_parking() {
  if (active_session == undefined) {
    alert("Sem sessão activa, tem que iniciar uma sessão primeiro pela app no telemovel! Se já iniciou faca refresh!");
    return;
  }

  var parking = new Parking();

  parking.setLicensePlate(document.getElementById("vehicles").value);
  parking.setPositionToken(document.getElementById("zones").value);
  parking.setStartDate(new Date());
  
  parking.setPromiseToken(promise_token);
  
  if (active_session.coordinates != null) {
    parking.setLatitude(active_session.coordinates[1]);
    parking.setLongitude(active_session.coordinates[0]);
  }

  var duration_html = document.getElementById("duration");
  var cost = duration_html.options[duration_html.selectedIndex].getAttribute('data-cost');
  var duration_ms = duration_html.options[duration_html.selectedIndex].getAttribute('data-duration');
  var charged_duration_ms = duration_html.options[duration_html.selectedIndex].getAttribute('data-charged-duration');

  parking.setCost(cost);
  parking.setDuration(duration_ms);
  parking.setChargedDuration(charged_duration_ms);

  api.startParkingSession(parking, function() {
    promise_token = undefined;
  });
}

function test_start_parking() {
  var parking = new Parking();

  parking.setLicensePlate(document.getElementById("vehicles").value);
  parking.setPositionToken(document.getElementById("zones").value);
  parking.setStartDate(new Date());

  api.checkParkingSession(parking, function(result) {
    var duration_html = document.getElementById("duration");

    // Remove childs
    while (duration_html.childElementCount > 0) {
      duration_html.removeChild(duration_html.firstChild);
    }

    for (var i = 0; i < result.values.length; i++) {
      var string = result.values[i].cost + "€ - " + get_time_string(result.values[i].charged_duration) + "m";
      var option = document.createElement("option");

      option.innerHTML = string;
      option.setAttribute('value', result.values[i].cost);
      option.setAttribute('data-cost', result.values[i].cost);
      option.setAttribute('data-duration', result.values[i].real_duration);
      option.setAttribute('data-charged-duration', result.values[i].charged_duration);

      duration_html.appendChild(option);
    }

    // Enable put button
    promise_token = result.promise_token;
    document.getElementById('start_parking').removeAttribute('disabled');

    // Show start / end time
    adjust_time();
  });
}

function adjust_time() {
  var now = new Date();
  var duration_html = document.getElementById("duration");
  var duration_ms = duration_html.options[duration_html.selectedIndex].getAttribute('data-duration');
  var final_date = new Date(now.getTime() + duration_ms/1);

  document.getElementById("session_starts_at").innerHTML = now.toLocaleString();
  document.getElementById("session_ends_at").innerHTML = final_date.toLocaleString();
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('agree').addEventListener('click', agree);
  document.getElementById('donotagree').addEventListener('click', donotagree);

  document.getElementById('login').addEventListener('click', login);
  document.getElementById('getActiveSessions').addEventListener('click', get_active_sessions);
  document.getElementById('getClosedSessions').addEventListener('click', get_closed_sessions);

  document.getElementById('municipal').addEventListener('click', get_municipal_information);
  document.getElementById('municipal').addEventListener('onchange', get_municipal_information);

  document.getElementById('test_start_parking').addEventListener('click', test_start_parking);
  document.getElementById('start_parking').addEventListener('click', start_parking);

  document.getElementById('duration').addEventListener('change', adjust_time);
});