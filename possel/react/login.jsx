var LoginField = React.createClass({
    displayName: 'LoginField',

    changeHandler: function(e) {
        var state = {};
        state[e.target.name] = e.target.value;
        this.setState(state)
    },
    keyHandler: function(e) {
        if (e.which === 13) {
            possel.events.flux.dispatch({
                actionType: possel.events.action.AUTH,
                data: {
                    user: this.state.user,
                    pass: this.state.pass
                }
            })
        }
    },
    getInitialState: function() {
        return {
            user: 'moredhel',
            pass: 'password'
        }
    },


    render: function() {
        return <div>
            <span>Please Login</span>
            <input onKeyPress={this.keyHandler} onChange={this.changeHandler} name="user" value={this.state.user}/>
            <input onKeyPress={this.keyHandler} onChange={this.changeHandler} name="pass" type="password" value={this.state.pass}/>
        </div>

    }
});
