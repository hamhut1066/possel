var MessageList = React.createClass({
    displayName: "MessageList",

    componentDidUpdate: function() {
        // HACK
        if (jdenticon) {
            jdenticon();
        }
    },

    createMessage: function(message, index) {
        var messageList = function(list) {
            return <p key={list.timestamp + '_message'}>{list.content}</p>
        }

        return <div key={index + '_msg'} className="media">
        <div className="media-left">
            <svg width="50" height="50" data-jdenticon-hash={CryptoJS.SHA1(message[0].nick)} className="media-object img-circle user-img"></svg>
        </div>
        <div className="media-body">
            <span className="usernick">{message[0].nick}</span>
            <span className="spacer"></span>
            <span className="usermsgtime">{moment.unix(message[0].timestamp).format('HH:mm:ss')}</span>
            {message.map(messageList)}
        </div>
        </div>
    },

    render: function() {
        var buffer = [];
        var i = 0;

        var messages = this.props.messages.reduce(function(prev_val, current_val, index, arr) {
            var current_user_list = prev_val.pop();
            if(!current_user_list) {
                current_user_list = [];
            }
            if (current_user_list.length > 0) {
                var current_user = current_user_list[current_user_list.length - 1];
                if (current_val.nick === current_user.nick) {
                    current_user_list.push(current_val);
                } else {
                    prev_val.push(current_user_list);
                    current_user_list = [current_val];
                }
            } else {
                current_user_list.push(current_val);
            }
            prev_val.push(current_user_list);
            return prev_val;
        }, [])
        return <div className="chatblock">
                    {messages.map(this.createMessage)}
        </div>
    }

});
