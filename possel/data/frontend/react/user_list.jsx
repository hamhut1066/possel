var UserList = React.createClass({
    displayName: "UserList",

    users: function() {
        // this probably needs to be put into the state object?...
        if (this.props.state.server) {
            return this.props.servers[this.props.state.server].buffers[this.props.state.buffer].users
        } else {
            return [];
        }
    },

    render: function() {
        var users = this.users();
        var constructUser = function(user) {
            return <li key={user.id + "_user"}><a href="">{user.nick}</a></li>
        };
        return <ul className="nicklist">
            {users.map(constructUser)}
        </ul>
    }
});

var UserListState = React.createClass({
    displayName: "userListState",

    getInitialState: function() {
        return {
            servers: [],
            state: {}
        }
    },

    componentDidMount: function() {
        possel.store.addChangeListener(this._onChange);
    },

    componentWillUnmount: function() {
        possel.store.removeChangeListener(this._onChange);
    },

    _onChange: function(state) {
        // todo: get the callback to inject the state.
        this.setState(state);
        /*         this.setState({
           messages: possel.store.getCurrentThread(),
           servers: possel.store.getServerList(),
           state: possel.store.state(),
           auth: possel.store.state().auth
           }); */
    },


    render: function() {
        return <UserList servers={this.state.servers} state={this.state.state} />
    }
});

