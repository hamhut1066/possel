'use strict';
var possel = {};
possel.store = (function() {
  /* Data Store */
  var callbacks = [];
  var servers = [];
  window.x = servers;
  /* mapping of servers and buffers */
  var buff_serv = [];

  var state = {
    server: 0,
    buffer: 0
  };

  var emit = function() {
    callbacks.map(function(callback, index) {
      callback();
    });
    return true;
  };

  return {
    changeSelection: function(server, buffer) {
      if (server) {
        state.server = server;
      }
      if (buffer) {
        state.buffer = buffer;
      }
      emit();
    },
    addChangeListener: function(callback) {
      callbacks.push(callback);
      return true;
    },
    removeChangeListener: function(callback) {
      callbacks = callbacks.filter(function(c) { return c !== callback; });
      return true;
    },
    getCurrentThread: function() {
      if (state.server == 0 || state.buffer == 0) {
        return [];
      }
      return servers[state.server].buffers[state.buffer].messages;
    },
    getServerList: function() {
      return servers;
    },

    add_server: function(server) {
      servers[server.id] = server;

      if(servers[server.id].buffers === undefined) {
        servers[server.id].buffers = [];
      }
      emit();
    },
    add_buffer: function(buffer) {
      servers[buffer.server].buffers[buffer.id] = buffer;
      if(servers[buffer.server].buffers[buffer.id].messages === undefined) {
        servers[buffer.server].buffers[buffer.id].messages = [];
      }

      buff_serv[buffer.id] = buffer.server;
      emit();
    },
    add_line: function(payload) {
      var buffer_id = payload.data[0].buffer;
      var buffer = servers[buff_serv[buffer_id]].buffers[buffer_id];

      buffer.messages.push(payload.data[0]);
      emit();
    }
  };
})();
possel.events = (function() {
  var dispatcher = new Flux.Dispatcher();

  var action = {
    GET_INITIAL_STATE: "get_initial_state",
    DATA_RECEIVED: "data_received",
    GET_USER: "get_user",
    GET_BUFFER: "get_buffer",
    GET_LINE_BY_ID: "get_line_by_id",
    SEND_EVENT: "send_event"
  };

  var type = {
    user: "user",
    server: "server",
    buffer: "buffer",
    line: "line"
  }

  var callbacks = {
    get_user: function(payload) {
      if(payload.actionType == action.GET_USER) {
        $.get("/user/" + payload.data.id).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.user});
        });
      }
    },
    get_server: function(payload) {
      if(payload.actionType == action.GET_SERVER) {
        $.get("/server/" + payload.data.id).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.server});
        });
      }
    },
    get_buffer: function(payload) {
      if(payload.actionType == action.GET_BUFFER) {
        $.get("/buffer/" + payload.data.id).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.buffer});
        });
      }
    },
    get_line_by_id: function(payload) {
      if(payload.actionType == action.GET_LINE_BY_ID) {
        $.get("/line?id=" + payload.data.id).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: type.line});
        });
      }
    },
    send_line: function(payload) {
      if (payload.actionType == action.SEND_EVENT) {
        $.ajax({
          type: 'POST',
          url: '/line',
          data: JSON.stringify({ buffer: payload.data.buffer,
                                 content: payload.data.content
                               }),
          contentType: 'application/json'
        }).then(function(data) {
          dispatcher.dispatch({actionType: action.DATA_RECEIVED, data: data, type: ""});
        });
      }
    },
    data_received: function(payload) {
      if (payload.actionType === action.DATA_RECEIVED) {
        switch (payload.type) {
        case type.user:
          console.warn("unknown functionality");
          break;
        case type.server:
          for (var i in payload.data) {
            possel.store.add_server(payload.data[i]);
          }
          break;
        case type.buffer:
          for (i in payload.data) {
            possel.store.add_buffer(payload.data[i]);
          }
          break;
        case type.line:
          possel.store.add_line(payload);
          break;
        default:
          console.warn("unknown type: ", payload);
        }
      }
    }
  };

  for (var key in callbacks) {
    dispatcher.register(callbacks[key]);
  }


  return {
    flux: dispatcher,
    action: action,
    initial_state: function(payload) {
      dispatcher.dispatch({actionType: action.GET_SERVER, data: {id: "all"}});
      dispatcher.dispatch({actionType: action.GET_BUFFER, data: {id: "all"}});
      // possel.store.changeSelection(1, 2);
    },
    handle_websocket_push: function(payload) {
      var msg = JSON.parse(event.data);

      switch(msg.type){
      case "line":
        dispatcher.dispatch({actionType: action.GET_LINE_BY_ID, data: {id: msg.line}});
        break;
      case "buffer":
        dispatcher.dispatch({actionType: action.GET_BUFFER, data: {id: msg.buffer}});
        break;
      case "user":
        dispatcher.dispatch({actionType: action.GET_USER, data: {id: msg.user}});
      default:
        console.warn("unknown message format received from websocket");
        console.warn(msg);
      }
    }
  };

})();
