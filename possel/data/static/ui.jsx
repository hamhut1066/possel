'use strict';
/* react ui for the thing */
/* creates a list of buffers */
var BufferItem = React.createClass({
    displayName: "BufferItem",

    handleClick: function() {
        var server = possel.store.buffParent(this.props.buffer);
        // Refactor out into props
        possel.store.state(server.id, this.props.buffer.id);
        this.setState({});
    },

    render: function() {
        var active = (possel.store.state().buffer === this.props.buffer.id) ? "active_buffer" : ""
        return <li onClick={this.handleClick} className={active}>
        {this.props.buffer.name}
        </li>
    }
});

var BufferList = React.createClass({
    displayName: "BufferList",

    render: function() {
        var buffers = this.props.buffers;
        var createBuffer = function (buffer, index) {
            return <BufferItem key={'#' + buffer.id} buffer={buffer}/>
        }
        return <ul className="" key={'bufferList'}>{buffers.map(createBuffer)}</ul>
    }
});

var ServerList = React.createClass({
    displayName: "ServerList",

    render: function() {
        var servers = this.props.servers;
        var createServer = function (server, index) {
            return <li key={'bufferlist' + index}>
                <em>{server.host}</em>
                <BufferList buffers={server.buffers} />
            </li>
        }
        return <ul className="list-unstyled">{servers.map(createServer)}</ul>
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

});

var InputBox = React.createClass({
    getInitialState: function() {
        return {value: ''};
    },
    changeHandler: function(event) {
        this.setState({value: event.target.value});
    },
    clickHandler: function(event) {
        this.submitHandler();
        this.setState({value: ''});
    },
    keyHandler: function(event) {
        if (event.which == 13) {
            this.submitHandler();
            this.setState({value: ''});
        }
    },

    submitHandler: function() {
        // do a dispatch thing.
        possel.events.flux.dispatch(
            {
                actionType: possel.events.action.SEND_EVENT,
                data: {
                    message: this.state.value,
                    buffer: possel.store.state().buffer
                }
            });

    },

    render: function() {
        var value = this.state.value;
        return <div className="col-lg-6">
            <div className="input-group">
                <input type="text" className="form-control" onKeyPress={this.keyHandler} onChange={this.changeHandler} value={value} />
                <span class="input-group-btn">
                    <button className="btn btn-default" onClick={this.clickHandler} type="button">Send</button>
                </span>
            </div>
        </div>
    }
});

var Application = React.createClass({
    displayName: "Application",

    componentDidMount: function() {
        possel.store.addChangeListener(this._onChange);
    },

    componentWillUnmount: function() {
        possel.store.removeChangeListener(this._onChange);
    },

    _onChange: function() {
        this.setState({
            messages: possel.store.getCurrentThread(),
            servers: possel.store.getServerList(),
            state: possel.store.state()
        });
    },

    render: function() {
        /* renders the entire application */
        return <div className="row">
                <div className="col-md-3">
                    <ServerList servers={this.state.servers} />
                </div>
                <div className="col-md-9">
                    <MessageList messages={this.state.messages}/>
                    <InputBox />
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
