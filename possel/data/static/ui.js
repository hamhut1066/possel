'use strict';
/* react ui for the thing */
/* creates a list of buffers */
var BufferList = React.createClass({
    displayName: "BufferList",

    render: function render() {
        var buffers = this.props.buffers;
        var createBuffer = function createBuffer(buffer, index) {
            return React.createElement(
                'li',
                { key: 'buffer' + index },
                buffer.name
            );
        };
        return React.createElement(
            'ul',
            null,
            buffers.map(createBuffer)
        );
    }
});

var ServerList = React.createClass({
    displayName: "ServerList",

    render: function render() {
        var servers = this.props.servers;
        var createServer = function createServer(server, index) {
            return React.createElement(
                'li',
                { key: 'bufferlist' + index },
                React.createElement(
                    'h1',
                    null,
                    server.host
                ),
                React.createElement(BufferList, { buffers: server.buffers })
            );
        };
        return React.createElement(
            'ul',
            null,
            servers.map(createServer)
        );
    }
});

var MessageList = React.createClass({
    displayName: "MessageList",

    render: function render() {
        var messages = this.props.messages;
        var createMessage = function createMessage(message, index) {
            return React.createElement(
                'li',
                { key: 'msg' + index },
                React.createElement(
                    'span',
                    null,
                    moment(message.timestamp).format('hh:mm:ss')
                ),
                React.createElement(
                    'span',
                    null,
                    message.nick
                ),
                React.createElement(
                    'span',
                    null,
                    message.content
                )
            );
        };
        return React.createElement(
            'ul',
            null,
            messages.map(createMessage)
        );
    }

});

var Application = React.createClass({
    displayName: "Application",

    componentDidMount: function componentDidMount() {
        possel.store.addChangeListener(this._onChange);
    },

    componentWillUnmount: function componentWillUnmount() {
        possel.store.removeChangeListener(this._onChange);
    },

    _onChange: function _onChange() {
        this.setState({ messages: possel.store.getCurrentThread(), servers: possel.store.getServerList() });
    },

    render: function render() {
        /* renders the entire application */
        return React.createElement(
            'div',
            null,
            React.createElement(
                'div',
                { 'class': 'col-md-1' },
                React.createElement(ServerList, { servers: this.state.servers })
            ),
            React.createElement(
                'div',
                { 'class': 'col-md-11' },
                React.createElement(MessageList, { messages: this.state.messages })
            )
        );
    },

    getInitialState: function getInitialState() {
        return {
            servers: [],
            messages: []
        };
    }
});

$(function () {
    var mountNode = document.getElementById("nodeMount");
    possel.node = React.render(React.createElement(Application, null), mountNode);

    possel.events.initial_state();
    var ws = new ReconnectingWebSocket(ws_url);
    ws.onopen = function () {
        console.log("connected");
    };
    ws.onclose = function () {
        console.log("disconnected");
    };
    ws.onmessage = possel.events.handle_websocket_push;
});
