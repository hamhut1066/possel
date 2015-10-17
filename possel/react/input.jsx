var InputBox = React.createClass({
    getInitialState: function() {
        return {value: ''};
    },
    changeHandler: function(event) {
        this.setState({value: event.target.value});
    },
    clickHandler: function(event) {
        this.submitHandler();
    },
    keyHandler: function(event) {
        if (event.which == 13) {
            this.submitHandler();
        }
    },

    submitHandler: function(event) {
        // do a dispatch thing.
        possel.events.flux.dispatch(
            {
                actionType: possel.events.action.SEND_EVENT,
                data: {
                    message: this.state.value,
                    buffer: possel.store.state().buffer
                }
            });
        this.setState(this.getInitialState());
        this.setState({});
    },

    render: function() {
        var value = this.state.value;
        return <footer className="input-field">
            <div className="form-inline" onSubmit={this.submitHandler}>
                <div className="form-group">
                    <input type="text" value={value}  onKeyPress={this.keyHandler} onChange={this.changeHandler} className="form-control" />
                    <input type="submit" onClick={this.clickHandler} className="form-control" />
                </div>
            </div>
        </footer>
    }
});
