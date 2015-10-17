var ServerList = React.createClass({
    displayName: "ServerList",

    render: function() {
        var servers = this.props.servers;
        var createServer = function (server, index) {
            return <div key={server.host + "_chan_list"}>
              <h6 key={server.host + "_title"}>{server.host}</h6>
              <BufferList buffers={server.buffers} />
            </div>
        }
        return <div>{servers.map(createServer)}</div>
    }
});
