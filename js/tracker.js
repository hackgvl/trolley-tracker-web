'use strict';
var tracker = {
  baseUrl: "http://yeahthattrolley.azurewebsites.net/api/v1/",
  tileLayer: {
    url: "https://api.mapbox.com/styles/v1/linktheoriginal/ciom3jx8k0006bolzuqwm7o3m/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibGlua3RoZW9yaWdpbmFsIiwiYSI6IjFjODFkODU1NGVkNWJhODQ2MTk5ZTk0OTVjNWYyZDE0In0.ptQUIfB07dQrUwDM2uMgUw",
    id: "examples.map-i875mjb7"
  },
  display: "tracker",
  updateInterval: 10000,
  defaultLocation: {
    lat: 34.852432,
    lon: -82.398216
  },

  map: {}, //leaflet + mapbox map

  load: function() {
    var self = this;
    this.initMap();

    //load data for the schedule, the trolleys, and the active routes
    jQuery.when(
      jQuery.getJSON(this.baseUrl + "/RouteSchedules", function(routeSchedules) {
        self.schedules = routeSchedules;
      }),

      jQuery.getJSON(this.baseUrl + "/Trolleys", function(trolleys) {
        self.trolleys = trolleys;
      }),

      jQuery.getJSON(this.baseUrl + "/Routes/Active", function(activeRoutes) {
        self.activeRoutes = activeRoutes;
      })

    ).done(function() {
      //fetch the individual route data for the currently active routes, then update the map
      var routeCalls = jQuery.map(self.activeRoutes, function(activeRoute) {
        return jQuery.getJSON(self.baseUrl + "/Routes/" + activeRoute.ID, function(route) {
          self.routes.push(route);
        });
      });

      jQuery.when.apply(jQuery, routeCalls).done(function() {
        self.loadSchedule();
        self.loadRoutes();
        self.loadStops();
        self.update();
      });
    });
  },

  initMap: function() {
    //leaflet + mapbox
    this.map = L.map('map', {
      scrollWheelZoom: false
    }).setView([this.defaultLocation.lat, this.defaultLocation.lon], 15);

    L.AwesomeMarkers.Icon.prototype.options.prefix = 'fa';

    L.tileLayer(this.tileLayer.url, {
      maxZoom: 18,
      tileSize: 512,
      zoomOffset: -1,
      id: this.tileLayer.id
    }).addTo(this.map);

    var control = L.Control.extend({
      options: {
        position: 'topright'
      },
      onAdd: function (map) {
        // create the map's control container - fetch from an html id
        var container = L.DomUtil.get('tracker-control');
        return container;
      }
    });

    this.map.addControl(new control);
  },

  loadSchedule: function() {
    jQuery('#schedule').html("Sorry - Not yet available!");
  },

  loadRoutes: function() {
    var self = this;

    for (var i = 0; i < self.routes.length; i++) {
      var route = self.routes[i];

      var routePoints = [];
      for (var j = 0; j < route.RouteShape.length; j++) {
        var point = route.RouteShape[j];
        routePoints.push(new L.LatLng(point.Lat, point.Lon));
      }

      var routePolyline = new L.Polyline(routePoints, {
        weight: 3,
        opacity: 0.5,
        smoothFactor: 1
      });

      routePolyline.setText('  ►  ', {repeat: true});
      self.routePolylines.push({
        "ID": route.ID,
        "polyline": routePolyline
      });
      routePolyline.addTo(self.map);
    }
  },
  
  loadStops: function() {
    var self = this;

    for (var i = 0; i < self.routes.length; i++) {
      var route = self.routes[i];

      for (var j = 0; j < route.Stops.length; j++) {
        var stop = route.Stops[j];

        var builtStopIds = jQuery.map(self.stopMapMarkers, function(stopMapMarker){
          return stopMapMarker.ID;
        });

        if (builtStopIds.indexOf(stop.ID) == -1) {
          var stopMapMarker = L.marker([stop.Lat, stop.Lon], { 
            icon: L.divIcon({
              className: "trolley-stop-icon"
            })
          });

          stopMapMarker.addTo(self.map).bindPopup("<p><b>" + stop.Name + "</b></p>");

          self.stopMapMarkers.push({
            ID: stop.ID,
            Name: stop.Name,
            mapMarker: stopMapMarker
          });
        }
      }
    }
  },

  //fetch current trolley data from the server, update trolley locations
  update: function() {
    var self = window.tracker;

    jQuery.getJSON(window.tracker.baseUrl + "/Trolleys/Running", function(runningTrolleyData) {
      /* [{
        "ID":1,
        "Lat":34.8422257,
        "Lon":-82.4064773
      }] */

      self.activeTrolleyIds = jQuery.map(runningTrolleyData, function(trolley) {
        return trolley.ID;
      });

      //update the lat/lng of the active trolleys
      for (var i = 0; i < runningTrolleyData.length; i++) {
        //could bring in underscore/lodash for _.find instead.
        var trolleyToUpdate = jQuery.grep(self.trolleys, function (trolley, index) {
          return trolley.ID == runningTrolleyData[i].ID;
        })[0];
        
        //TODO - add error checking if update returned a trolley that's not in our list
        trolleyToUpdate.CurrentLat = runningTrolleyData[i].Lat;
        trolleyToUpdate.CurrentLon = runningTrolleyData[i].Lon;
      }

      self.updateTrolleyMarkers();
      if (self.display == "tracker") {
        setTimeout(self.update, self.updateInterval);
      }
    });
  },

  updateTrolleyMarkers: function() {
    var self = this;

    for (var i = 0; i < this.activeTrolleyIds.length; i++) {
      //TODO - error handling if the trolley isn't found
      var trolley = jQuery.grep(this.trolleys, function(trolley, index) {
        return trolley.ID == self.activeTrolleyIds[i];
      })[0];

      var trolleyMapMarker = jQuery.grep(this.trolleyMapMarkers, function(trolleyMapMarker, index) {
        return trolleyMapMarker.ID == self.activeTrolleyIds[i];
      })[0];
      
      if (trolleyMapMarker) {
        //update marker
        trolleyMapMarker.mapMarker.setLatLng([trolley.CurrentLat, trolley.CurrentLon]);
      } else {        
        //add new marker
        trolleyMapMarker = {
          ID: this.activeTrolleyIds[i],
          mapMarker: L.marker([trolley.CurrentLat, trolley.CurrentLon], {
            icon: L.AwesomeMarkers.icon({
              icon: 'bus',
              markerColor: trolley.IconColorRGB ? trolley.IconColorRGB : 'red'
            })
          })
        };

        trolleyMapMarker.mapMarker.addTo(this.map);

        this.trolleyMapMarkers.push(trolleyMapMarker);
      }
      //TODO - remove old markers
    }
  },

  trolleyMapMarkers: [],
  /* [{
    "ID":5,
    "mapMarker": {L.marker}
  }] */

  stopMapMarkers: [],
  /* [{
    "ID":31,
    "Name":"Fluor Field",
    "mapMarker": {L.marker}
  }] */

  routePolylines: [],
  /* [{
    "ID":5,
    "polyline": {L.Polyline}
  }] */

  activeRoutes: [],
  /* [{
    "ID":5,
    "ShortName":"Heritage Green",
    "LongName":"Main Street, Including Heritage Green",
    "Description":"Main Street, North Main, Heritage Green and County Square Park and Ride",
    "FlagStopsOnly":false
  }] */

  schedules: [],
  /* [{
    "ID":50,
    "RouteID":5,
    "DayOfWeek":"Sunday",
    "StartTime":"1:00 PM",
    "EndTime":"6:00 PM",
    "RouteLongName":"Main Street, Including Heritage Green"
  }] */

  routes: [],
  /* [{
    "ID":6,
    "ShortName":"BallGame",
    "LongName":"Greenville Drive Ball Game",
    "Description":"Shuttle on game nights Fluor Field to County Square",
    "FlagStopsOnly":false,
    "Stops":[{
        "ID":39,
        "Name":"Fluor Field",
        "Description":"Fluor Field",
        "Lat":34.8416466,
        "Lon":-82.407466,
        "StopImageURL":null,
        "LastTrolleyArrivalTime":{
          "5":"2017-06-25T16:39:32.4026481",
          "6":"2017-06-25T16:55:55.3628703"
        }
    }],
    "RouteShape":[{
      "Lat":34.8413537,
      "Lon":-82.4047159
    }]
  }] */

  trolleys: [],
  /* [{
    "ID":1,
    "TrolleyName":"Trolley",
    "Number":6,
    "CurrentLat":34.855824,
    "CurrentLon":-82.394571,
    "LastBeaconTime":"2017-06-25T17:18:51.64",
    "IconColorRGB":"#353a72"
  }] */

  activeTrolleyIds: [] //integers
};

/*
 * Attempt to geolocate the user through the browser, and, if 
 * successful, add a pin for the user's current location and
 * add a pin on it.  This only runs once on pageload.
 */
/*
var currentPosMarker; //user location via browser get location

function getUserLocation(map){
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position){
      //console.log(position.coords.latitude + "," + position.coords.longitude);
      //oMap.setView([position.coords.latitude, position.coords.longitude], 16);
      var userPositionMarker = L.AwesomeMarkers.icon({
        icon: 'star',
        markerColor: 'green'
      });

      currentPosMarker = L.marker([position.coords.latitude, position.coords.longitude],{
        icon: userPositionMarker
      })
        .addTo(map)
        .bindPopup("<b>You are here!</b>");
    });
  }
}

*/
function closeInfo() {
  jQuery('#info').hide(); 
  jQuery('#info-question').show();
  jQuery('#info-schedule').show();
}

function showInfo() {
  jQuery('#info').show();
  jQuery('#info-question').hide();
  jQuery('#info-schedule').hide();
}

function closeSchedule() {
  jQuery('#schedules').hide();
  jQuery('#info-question').show();
  jQuery('#info-schedule').show();
}

function showSchedule() {
  jQuery('#schedules').show();
  jQuery('#info-question').hide();
  jQuery('#info-schedule').hide();
}

//custom controls
//topright - map
//schedule - bottomleft
//back - bottomright