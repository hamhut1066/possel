'use strict';
/* react ui for the thing */
/* creates a list of buffers */
var BufferList = React.createClass({
    displayName: "BufferList",

    render: function() {
        var buffers = this.props.buffers;
        var createBuffer = function (buffer, index) {
            return <li key={'buffer' + index}>{buffer.name}</li>
        }
        return <ul>{buffers.map(createBuffer)}</ul>
    }
});

var ServerList = React.createClass({
    displayName: "ServerList",

    render: function() {
        var servers = this.props.servers;
        var createServer = function (server, index) {
            return <li key={'bufferlist' + index}>
                <h1>{server.host}</h1>
                <BufferList buffers={server.buffers} />
            </li>
        }
        return <ul>{servers.map(createServer)}</ul>
    }
});

var MessageList = React.createClass({
    displayName: "MessageList",

    render: function() {
        var messages = this.props.messages;
        var createMessage = function(message, index) {
            return <li key={'msg' + index}>
                <span>{moment(message.timestamp).format('hh:mm:ss')}</span>
                <span>{message.nick}</span>
                <span>{message.content}</span>
            </li>
        }
        return <ul>{messages.map(createMessage)}</ul>
    }

})

var Application = React.createClass({
    displayName: "Application",

    componentDidMount: function() {
        possel.store.addChangeListener(this._onChange);
    },

    componentWillUnmount: function() {
        possel.store.removeChangeListener(this._onChange);
    },

    _onChange: function() {
        this.setState({ messages: possel.store.getCurrentThread(), servers: possel.store.getServerList()});
    },

    render: function() {
        /* renders the entire application */
        return <div>
                <div class="col-md-1">
                    <ServerList servers={this.state.servers} />
                </div>
                <div class="col-md-11">
                    <MessageList messages={this.state.messages}/>
                </div>
        </div>
    },

    getInitialState: function() {
        return {
            servers: [],
            messages: []
        }
    }
})

$(function() {
  var mountNode = document.getElementById("nodeMount");
  possel.node = React.render(React.createElement(Application, null), mountNode);

  possel.events.initial_state();
  var ws = new ReconnectingWebSocket(ws_url);
  ws.onopen = function() {
    console.log("connected");
  };
  ws.onclose = function() {
    console.log("disconnected");
  };
  ws.onmessage = possel.events.handle_websocket_push;
});
