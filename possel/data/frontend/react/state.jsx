var Application = React.createClass({
    displayName: "Application",

    componentDidMount: function() {
        possel.store.addChangeListener(this._onChange);
    },

    componentWillUnmount: function() {
        possel.store.removeChangeListener(this._onChange);
    },

    _onChange: function(store) {
        // TODO: get the callback to inject the state.
        this.setState({
            messages: possel.store.getCurrentThread(),
            servers: possel.store.getServerList(),
            state: possel.store.state(),
            auth: possel.store.state().auth
        });
    },

    render: function() {
        /* renders the entire application */
        if (!this.state.state.auth) {
            return <LoginField />
        }
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
            state: {
                auth: false
            },
            servers: [],
            messages: []
        }
    }
});

var MessageState = React.createClass({
    displayName: "MessageState",

    getInitialState: function() {
        return possel.store.initialState();
    },

    componentDidMount: function() {
        possel.store.addChangeListener(this._onChange);
    },

    componentWillUnmount: function() {
        possel.store.removeChangeListener(this._onChange);
    },

    _onChange: function(state) {
        this.setState(state);
        /*         this.setState({
           messages: possel.store.getCurrentThread(),
           servers: possel.store.getServerList(),
           state: possel.store.state(),
           auth: possel.store.state().auth
           }); */
    },

    messages: function() {
        if (this.state.state.server !== 0) {
            return this.state.servers[this.state.state.server].buffers[this.state.state.buffer].messages || [];
        } else {
            return [];
        }
    },

    render: function() {
        if (!this.state.state.auth) {
            return <LoginField />
        }
        return <MessageList messages={this.messages()} />
    }

});

var ServerListState = React.createClass({
    displayName: "ServerListState",

    getInitialState: function() {
        return possel.store.initialState();
    },

    componentDidMount: function() {
        possel.store.addChangeListener(this._onChange);
    },

    componentWillUnmount: function() {
        possel.store.removeChangeListener(this._onChange);
    },

    _onChange: function(state) {
        this.setState(state);
        /* this.setState({
           messages: possel.store.getCurrentThread(),
           servers: possel.store.getServerList(),
           state: possel.store.state(),
           auth: possel.store.state().auth
         }); */
    },

    render: function() {
        if (!this.state.state.auth) {
            return <div></div>
        }
        return <ServerList servers={this.state.servers} />
    }
})

window.auth = function() {
      var username = "moredhel";
      var password = "password";
      var data = JSON.stringify({username: username, password: password});
      return $.ajax({
        type: 'POST',
        url: '/session',
        data: data,
        contentType: 'application/json'
      }).then(function() {})
}

$(function() {
    var mountNode = document.getElementById("chan_list");
    ReactDOM.render(React.createElement(ServerListState), mountNode);
    var messageNode = document.getElementById("chat_block");
    ReactDOM.render(React.createElement(MessageState), messageNode);
    var inputNode = document.getElementById("input_block");
    ReactDOM.render(React.createElement(InputBox), inputNode);
    var userNode = document.getElementById("user_block");
    ReactDOM.render(React.createElement(UserListState), userNode);
    // possel.events.initial_state();
});
