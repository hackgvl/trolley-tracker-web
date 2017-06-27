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

    //load data from the various necessary endpoints, then update.
    jQuery.when(
      jQuery.getJSON(this.baseUrl + "/RouteSchedules", function(routeSchedules) {
        self.schedules = routeSchedules;
      }),

      jQuery.getJSON(this.baseUrl + "/Trolleys", function(trolleys) {
        self.trolleys = trolleys;
      }),

      jQuery.getJSON(this.baseUrl + "/Routes/Active", function(activeRoutes) {
        self.activeRoutes = activeRoutes;
      }).then(self.fetchRouteData(self))

    ).done(function() {      
      self.update();
    });
  },

  fetchRouteData: function(self) {
    var routeCalls = [];
    for(var i = 0; i < self.activeRoutes.length; i++) {
      routeCalls.push(jQuery.getJSON(self.baseUrl + "/Routes/" + self.activeRoutes[i].ID, function(route) {
        self.routes.push(route);
      }));
    }
    return routeCalls;
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

  initRoutes: function() {
    /*
    var pointList = [];
    data.forEach(function(loc, index, array){
      pointList.push(new L.LatLng(loc.Lat, loc.Lon));
    });

    var routePolyLine = new L.Polyline(pointList, {
      color: color.color,
      weight: 3,
      opacity: 0.5,
      smoothFactor: 1
    });

    //use the settext plugin to add directional arrows to the route.
    routePolyLine.setText('  ►  ', {repeat: true, attributes: {fill: color.color}});

    //store the new polyline in the routes object
    routes.push(routePolyLine);

    routePolyLine.addTo(this.map);
    */
  },

  initStops: function() {
    /*
    stoplocs.forEach(function(loc, index, array) {
    var stopMarker = L.divIcon({className: "trolley-stop-icon " + color.css});
    
    var oMapMarker = L.marker([loc.Lat, loc.Lon], {
      icon: stopMarker
    });

    oMapMarker.Name = loc.Name;
    oMapMarker.StopImageURL = loc.StopImageURL;

    bStopExists = false;

    stops.forEach(function(existloc, existindex, existarray) {
      if (existloc._latlng.lat == loc.Lat && existloc._latlng.lng == loc.Lon) {
        //then this stop is on two routes.  relying on setting the color name as the LAST class argument.  (first is trolley-stop-icon)
        //this will build color strings of all colors to show (red-green-blue if it's on three routes initialized in that order)
        existloc.options.icon.options.className = existloc.options.icon.options.className + "-" + color.css;
      }
    });

    stops.push(oMapMarker);
    */
  },

  //fetch current trolley data from the server, update tracker state, call update map
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

      self.updateMap();
      if (self.display == "tracker") {
        setTimeout(self.update, self.updateInterval);
      }
    });
  },

  updateMap: function() {
    this.updateTrolleyMarkers();
    this.updateMapRoutes()
    this.updateStopMarkers();
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

  updateMapRoutes: function() {
    
  },

  updateStopMarkers: function() {
    /*
    stops.forEach(function(loc, index, array) {
      loc.addTo(oMap).bindPopup("<p><b>" + loc.Name + "</b>" + sImageHTML + "</p>");
    });
    */
  },

  trolleyMapMarkers: [],

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
      } 
    }] */

    trolleys: [],
    /* {
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