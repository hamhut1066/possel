var BufferItem = React.createClass({
    displayName: "BufferItem",

    handleClick: function() {
        var server = possel.store.buffParent(this.props.buffer);
        // TODO: Refactor out into props (ie. dispatch event and push back down.)
        possel.store.state(server.id, this.props.buffer.id);
    },

    render: function() {
        var active = (possel.store.state().buffer === this.props.buffer.id) ? "active" : ""
        return <li onClick={this.handleClick} className={active}>
        <i className="channel">#</i>{this.props.buffer.name}<span className="badge label-light"></span>
        <a className="pull-right part" href=""><i className="fa fa-close"></i></a>
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
        return <ul className="nicklist" key={'bufferList'}>{buffers.map(createBuffer)}</ul>
    }
});
