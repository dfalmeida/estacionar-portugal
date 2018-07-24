class API {
    getBaseUrl() {
        return 'https://eos.empark.com/api/v1.0';
    }

    getHeaders() {
      var headers = {};
  
      if (this.getUserSessionToken() !== undefined) {
          headers["X-EOS-USER-TOKEN"] = this.getUserSessionToken();
      }

      // Client Token for Via Verde
      headers["X-EOS-CLIENT-TOKEN"] = "2463bc87-6e92-480e-a56b-4260ff8b6a38";
      headers["Content-type"] = "application/json; charset=utf-8";
      headers["User-Agent"] = "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.76 Mobile Safari/537.36";
  
      return headers;
    }
  
    makeGetRequest(url, callback, errorCallback) {
      return fetch(this.getBaseUrl() + url, {
        headers: this.getHeaders()
      })
      .then(response => {
        if (response.status == 200) {
          response.json().then(body => {
            callback(body);
          });
        } else {
          errorCallback(response)
        }
      })
      .catch(errorCallback);
    }
  
    makePostRequest(url, data, callback, errorCallback) {
      return fetch(this.getBaseUrl() + url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      })
      .then(response => response.json())
      .then(callback)
      .catch(errorCallback);
    }
  
    handleErrorMessages(error, callback, retry) {
      console.log(error);
      if (error.type == "authenticationFailed" && error.message == "invalid token") {
        this.setUserSessionToken(undefined);
  
        // Update config
        chrome.storage.sync.set({config: config});
  
        // Try to login again
        this.login(config.email, config.password);
  
        if (retry == true && callback !== undefined) {
            this.login(config.email, config.password, callback);
        } else {
          this.login(config.email, config.password);
        }
      }
    }
  
    getAccountToken() {
      return this.account_token;
    }
  
    setAccountToken(account_token) {
      this.account_token = account_token;
    }
  
    getUserSessionToken() {
      return this.user_session_token;
    }
  
    setUserSessionToken(user_session_token) {
      this.user_session_token = user_session_token;
    }
  
    //
    // High Level
    //

    login(email, password, successfulCallback, errorCallback) {
      this.makePostRequest('/auth/accounts/', {
        username: email,
        password: password
      }, response => {
        if (response.type == "accNotFound") {
          console.log("Account not found! Try another user!");  
          this.setUserSessionToken(undefined);
          alert("Account not found!");
        } else {
          // Login successful
          this.account_token = response.account_token;
          this.user_session_token = response.user_session_token;
          this.client_token = response.client_token;
  
          config.account_token = response.account_token;
          config.user_session_token = response.user_session_token;
  
          chrome.storage.sync.set({config: config});

          if (successfulCallback !== undefined) {
            successfulCallback(response);
          }
        }
      }, error => {
        error.json().then(error_json => {
          this.handleErrorMessages(error_json);

          if (errorCallback !== undefined) {
            errorCallback(error_json);
          }
        });
      });
    }
    
    getVehicles(successfulCallback, errorCallback) {
      if (this.getAccountToken() !== undefined) {
        this.makeGetRequest("/accounts/" + this.getAccountToken() + "/vehicles/",
         response => {
             if (successfulCallback !== undefined) {
                successfulCallback(response);
             }
        },
        error => {
            error.json().then( error_body => {
                // Handle this generic
                if (error.type == "authenticationFailed" && error.message == "invalid token") {
                    errorCallback('LOGIN_MISSING');
                }
            });
        });
      } else {
          if (errorCallback !== undefined) {
            errorCallback('LOGIN_MISSING');
          }
      }
    }
  
    /**
     * Get Sessions
     *
     * - type: ACTIVE, CLOSED
     */
    getSessions(type, successfulCallback, errorCallback) {
        this.makeGetRequest("/parking/sessions?account=" + this.getAccountToken() + "&session_state=" + type,
            function (response) {
            if (successfulCallback !== undefined) {
                successfulCallback(response);
            }
        },
        function (error) {
            error.json().then( error_body => {
                if (errorCallback !== undefined) {
                    errorCallback(error_body);
                } else {
                    this.handleErrorMessages(error_body);
                }
            });
        });
    }
  
    getAllConcessionary() {
      this.makeGetRequest("/concessionary/all_concessionaries",
        function (response) {
          console.log("Sessions");
          console.log(response);
  
          concessionaries = response;
  
          var concessionary_html = document.getElementById("concessionary");
  
          // Remove childs
          while (concessionary_html.childElementCount > 0) {
              concessionary_html.removeChild(concessionary_html.firstChild);
          }
  
          // Insert new childs
          for (var i = 0; i < response.length; i++) {
              var option = document.createElement("option");
              option.setAttribute("value", i);
              option.innerHTML = response[i].name;
              concessionary_html.appendChild(option);
          }
      },
      function (error) {
        console.log("get ALL CONCESSIONARIES :: Error");
        console.log(error);
      });
    }
  
    getAllMunicipal(successfulCallback, errorCallback) {
      this.makeGetRequest("/centers/services?type=MUNICIPAL_CONTEXT",
        response => {
          if (successfulCallback !== undefined) {
              successfulCallback(response);
          }
      }, error => {
        error.json().then(error_json => {
          this.handleErrorMessages(error_json, this.getAllMunicipal, false);

          if (errorCallback !== undefined) {
            errorCallback(error_body);
          }
        });
      });
    }
  
    getMunicipal(id, successfulCallback, errorCallback) {
      this.makeGetRequest("/geo/search?context_token=" + id + "&polygon_info=true",
        response => {
          if (successfulCallback !== undefined) {
            successfulCallback(response);
          }
      },
      error => {
        error.json().then(error_body => {
            if (errorCallback !== undefined) {
                errorCallback(error_body);
            }
        });
      });
    }
  
    checkParkingSession(parking, successfulCallback, errorCallback) {
        var body = {
            "account_token": "" + this.getAccountToken(),
            "dtstart": {
                "date": parking.getStartDate().toISOString().split('.')[0] + "Z"
            },
            "plate": {
                "id": "" + parking.getLicensePlate(),
                "type": "PT"
            },
            "position_token": "" + parking.getPositionToken(),
            "type": "MANAGED"
        };

        this.makePostRequest('/parking/fares/table/', body,
            response => {
                console.log("Fares")
                console.log(response);

                if (successfulCallback !== undefined) {
                    successfulCallback(response);
                }
            },
            error => {
                console.log("Fares :: Error")
                console.log(error);

                if (errorCallback !== undefined) {
                    errorCallback(error);
                }
            }
        );
    }

    startParkingSession(parking, successfulCallback, errorCallback) {
      if (this.getAccountToken() !== undefined && parking.getStartDate() instanceof Date) {
        var body = {
            "account_token": "" + this.getAccountToken(),
            "coordinates_key": {
                "latitude": parking.getLatitude(),
                "longitude": parking.getLongitude()
            },
            "cost_time_pair": {
                "cost": parking.getCost(),
                "duration_ms": parking.getDuration(),
                "charged_duration_ms": parking.getChargedDuration()
            },
            "dtstart": {
                "date": parking.getStartDate().toISOString().split('.')[0] + "Z"
            },
            "plate": {
                "id": parking.getLicensePlate(),
                "type": "PT"
            },
            "position_token": "" + parking.getPositionToken(),
            "promise_token": "" + parking.getPromiseToken(),
            "type": "MANAGED"
        };
  
        this.makePostRequest('/parking/sessions/', body,
          response => {
            console.log("Start parking sessions starting at " 
            + parking.getStartDate().toLocaleString() 
            + " for " + (parking.getDuration()/1000/60) 
            + " minutes.");

            console.log(response);

            if (successfulCallback !== undefined) {
                successfulCallback(response);
            }

            // TODO: Check for sessions and add notifications
          },
          error => {
            console.log("Start Parking Sessions :: Error");
            console.log(error);

            if (errorCallback !== undefined) {
                errorCallback(error);
            }
          }
        );
      }
    }
}

class Parking {
    constructor() {
        this.latitude = 0;
        this.longitude = 0;
        this.license_plate = undefined;
        this.start_date = undefined;
        this.position_token = undefined;
        this.promise_token = undefined;
        this.cost = undefined;
        this.duration_ms = 0;
        this.charged_duration_ms = 0;
    }

    setLicensePlate(license_plate) {
        this.license_plate = license_plate;
    }

    getLicensePlate() {
        return this.license_plate;
    }

    setPromiseToken(promise_token) {
        this.promise_token = promise_token;
    }

    getPromiseToken() {
        return this.promise_token;
    }

    setPositionToken(position_token) {
        this.position_token = position_token;
    }

    getPositionToken() {
        return this.position_token;
    }

    setStartDate(date) {
        this.start_date = date;
    }

    getStartDate() {
        return this.start_date;
    }

    setLatitude(latitude) {
        this.latitude = latitude;
    }

    getLatitude() {
        return this.latitude;
    }

    setLongitude(longitude) {
        this.longitude = longitude;
    }

    getLongitude() {
        return this.longitude;
    }

    setCost(cost) {
        this.cost = cost;
    }

    getCost() {
        return this.cost;
    }

    setDuration(duration) {
        this.duration_ms = duration;
    }

    getDuration() {
        return this.duration_ms;
    }

    setChargedDuration(charged_duration) {
        this.charged_duration_ms = charged_duration;
    }

    getChargedDuration() {
        return this.charged_duration_ms;
    }
}