'use strict';
/* react ui for the thing */
/* creates a list of buffers */
var BufferItem = React.createClass({
    displayName: "BufferItem",

    handleClick: function handleClick() {
        var server = possel.store.buffParent(this.props.buffer);
        // Refactor out into props
        possel.store.state(server.id, this.props.buffer.id);
        this.setState({});
    },

    render: function render() {
        var active = possel.store.state().buffer === this.props.buffer.id ? "active_buffer" : "";
        return React.createElement(
            "li",
            { onClick: this.handleClick, className: active },
            this.props.buffer.name
        );
    }
});

var BufferList = React.createClass({
    displayName: "BufferList",

    render: function render() {
        var buffers = this.props.buffers;
        var createBuffer = function createBuffer(buffer, index) {
            return React.createElement(BufferItem, { key: '#' + buffer.id, buffer: buffer });
        };
        return React.createElement(
            "ul",
            { className: "", key: 'bufferList' },
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
                "li",
                { key: 'bufferlist' + index },
                React.createElement(
                    "em",
                    null,
                    server.host
                ),
                React.createElement(BufferList, { buffers: server.buffers })
            );
        };
        return React.createElement(
            "ul",
            { className: "list-unstyled" },
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
                "li",
                { key: 'msg' + index },
                React.createElement(
                    "span",
                    null,
                    moment(message.timestamp).format('hh:mm:ss')
                ),
                React.createElement(
                    "span",
                    null,
                    message.nick
                ),
                React.createElement(
                    "span",
                    null,
                    message.content
                )
            );
        };
        return React.createElement(
            "ul",
            { className: "list-unstyled" },
            messages.map(createMessage)
        );
    }

});

var InputBox = React.createClass({
    displayName: "InputBox",

    getInitialState: function getInitialState() {
        return { value: '' };
    },
    changeHandler: function changeHandler(event) {
        this.setState({ value: event.target.value });
    },
    clickHandler: function clickHandler(event) {
        this.submitHandler();
        this.setState({ value: '' });
    },
    keyHandler: function keyHandler(event) {
        if (event.which == 13) {
            this.submitHandler();
            this.setState({ value: '' });
        }
    },

    submitHandler: function submitHandler() {
        // do a dispatch thing.
        possel.events.flux.dispatch({
            actionType: possel.events.action.SEND_EVENT,
            data: {
                message: this.state.value,
                buffer: possel.store.state().buffer
            }
        });
    },

    render: function render() {
        var value = this.state.value;
        return React.createElement(
            "div",
            { className: "col-lg-6" },
            React.createElement(
                "div",
                { className: "input-group" },
                React.createElement("input", { type: "text", className: "form-control", onKeyPress: this.keyHandler, onChange: this.changeHandler, value: value }),
                React.createElement(
                    "span",
                    { "class": "input-group-btn" },
                    React.createElement(
                        "button",
                        { className: "btn btn-default", onClick: this.clickHandler, type: "button" },
                        "Send"
                    )
                )
            )
        );
    }
});

var LoginField = React.createClass({
    displayName: 'LoginField',

    changeHandler: function changeHandler(e) {
        var state = {};
        state[e.target.name] = e.target.value;
        this.setState(state);
    },
    keyHandler: function keyHandler(e) {
        if (e.which === 13) {
            possel.events.flux.dispatch({
                actionType: possel.events.action.AUTH,
                data: {
                    user: this.state.user,
                    pass: this.state.pass
                }
            });
        }
    },
    getInitialState: function getInitialState() {
        return {
            user: 'moredhel',
            pass: 'password'
        };
    },

    render: function render() {
        return React.createElement(
            "div",
            null,
            React.createElement(
                "span",
                null,
                "Please Login"
            ),
            React.createElement("input", { onKeyPress: this.keyHandler, onChange: this.changeHandler, name: "user", value: this.state.user }),
            React.createElement("input", { onKeyPress: this.keyHandler, onChange: this.changeHandler, name: "pass", type: "password", value: this.state.pass })
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
        this.setState({
            messages: possel.store.getCurrentThread(),
            servers: possel.store.getServerList(),
            state: possel.store.state(),
            auth: possel.store.state().auth
        });
    },

    render: function render() {
        /* renders the entire application */
        if (!this.state.auth) {
            return React.createElement(LoginField, null);
        }
        return React.createElement(
            "div",
            { className: "row" },
            React.createElement(
                "div",
                { className: "col-md-3" },
                React.createElement(ServerList, { servers: this.state.servers })
            ),
            React.createElement(
                "div",
                { className: "col-md-9" },
                React.createElement(MessageList, { messages: this.state.messages }),
                React.createElement(InputBox, null)
            )
        );
    },

    getInitialState: function getInitialState() {
        return {
            auth: false,
            servers: [],
            messages: []
        };
    }
});

$(function () {
    var mountNode = document.getElementById("nodeMount");
    possel.node = React.render(React.createElement(Application, null), mountNode);
    possel.events.initial_state();
});

window.auth = function () {
    var username = "moredhel";
    var password = "password";
    var data = JSON.stringify({ username: username, password: password });
    return $.ajax({
        type: 'POST',
        url: '/session',
        data: data,
        contentType: 'application/json'
    }).then(function () {});
};
