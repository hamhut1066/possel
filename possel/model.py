#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
possel.model
------------

This module defines an API for storing the state of an IRC server and probably includes some database bits too.
"""
import collections
import datetime
import logging

import peewee as p

import pircel
from pircel import protocol, signals

from playhouse import shortcuts


logger = logging.getLogger(__name__)
signal_factory = signals.namespace('model')


class Error(pircel.Error):
    """ Root exception for model related exceptions.

    e.g. Exceptions which are thrown when there is a state mismatch. """


class UserNotFoundError(Error):
    """ Exception Thrown when action is performed on non-existent nick.  """


class UserAlreadyExistsError(Error):
    """ Exception Thrown when there is an attempt at overwriting an existing user. """


class ModeNotFoundError(Error):
    """ Exception thrown when we try to remove a mode that a user doesn't have. """


class ServerAlreadyAttachedError(Error):
    """ Exception thrown when someone tries to attach a server handler to a server interface that already has one. """


class KeyDefaultDict(collections.defaultdict):
    """ defaultdict modification that provides the key to the factory. """
    def __missing__(self, key):
        if self.default_factory is not None:
            self[key] = self.default_factory(key)
            return self[key]
        else:
            return super(KeyDefaultDict, self).__missing__(key)


database = p.Proxy()


class BaseModel(p.Model):
    class Meta:
        database = database

    def to_dict(self):
        return shortcuts.model_to_dict(self, recurse=False)


class UserDetails(BaseModel):
    """ Models all details that are pertinent to every user.

    Users that are connected to a server should use IRCUserModel, this is only really for defining our own details (e.g.
    so we can send the "NICK ..." message at initial connection).
    """
    nick = p.CharField()
    realname = p.TextField(null=True)
    username = p.TextField(null=True)


class IRCServerModel(BaseModel):
    """ Models an IRC server, including how to connect to it.

    Does *not* reference networks yet, if ever.
    """
    # =========================================================================
    # Connection Details
    # ------------------
    #
    # Standard IRC connection stuff.
    #
    # Doesn't interact with protocol objects; interesting to note?
    # =========================================================================
    host = p.TextField()
    port = p.IntegerField(default=6697)  # You're damn right we default to SSL
    secure = p.BooleanField(default=True)
    # =========================================================================

    # =========================================================================
    # User Details
    # ------------
    #
    # Who *we* are on this server.
    # =========================================================================
    user = p.ForeignKeyField(UserDetails)
    # =========================================================================

    class Meta:
        indexes = ((('host', 'port'), True),
                   )


class IRCUserModel(UserDetails):
    """ Models users that are connected to an IRC Server.

    Inherits most of its fields from UserDetails.

    Don't delete user models, they're needed for line models.
    """
    host = p.TextField(null=True)  # where they're coming from
    server = p.ForeignKeyField(IRCServerModel, related_name='users', on_delete='CASCADE')
    current = p.BooleanField()  # are they connected?

    class Meta:
        indexes = ((('server', 'nick'), False),
                   (('server', 'nick', 'current'), False),
                   )


BUFFER_TYPES = [('normal', 'Standard Buffer'),
                ('system', 'System buffer for a server'),
                ]


class IRCBufferModel(BaseModel):
    """ Models anything that will store a bunch of messages and maybe have some people in it.

    This means channels and PMs.
    """
    name = p.TextField()  # either a channel '#channel' or a nick 'nick'
    server = p.ForeignKeyField(IRCServerModel, related_name='buffers', on_delete='CASCADE', null=True)
    kind = p.CharField(max_length=20, default='normal', choices=BUFFER_TYPES)
    current = p.BooleanField()  # Are we in it?

    class Meta:
        indexes = ((('name', 'server'), True),
                   )


LINE_TYPES = [('message', 'Message'),
              ('notice', 'Notice'),
              ('join', 'Join'),
              ('part', 'Part'),
              ('quit', 'Quit'),
              ('nick', 'Nick Change'),
              ('topic', 'Topic Change'),
              ('action', 'Action'),
              ('other', 'Other'),
              ]  # TODO: Consider more/less line types? Line types as display definitions?


class IRCLineModel(BaseModel):
    """ Models anything that might be displayed in a buffer.

    Typically this will be messages, notices, CTCP ACTIONs, joins, quits, mode changes, topic changes, etc.
    """
    # Where
    buffer = p.ForeignKeyField(IRCBufferModel, related_name='lines', on_delete='CASCADE')

    # Who and when
    timestamp = p.DateTimeField(default=datetime.datetime.utcnow)
    user = p.ForeignKeyField(IRCUserModel, null=True, on_delete='CASCADE')  # Can have lines with no User displayed
    nick = p.TextField(null=True)  # We store the nick of the user at the time of the message

    # What
    kind = p.CharField(max_length=20, default='message', choices=LINE_TYPES)
    content = p.TextField()

    def to_dict(self):
        d = shortcuts.model_to_dict(self, recurse=False)
        d['timestamp'] = d['timestamp'].replace(tzinfo=datetime.timezone.utc).timestamp()
        return d


class IRCBufferMembershipRelation(BaseModel):
    """ Buffers and Users have a many-to-many relationship, this handles that. """
    buffer = p.ForeignKeyField(IRCBufferModel, related_name='memberships', on_delete='CASCADE')
    user = p.ForeignKeyField(IRCUserModel, related_name='memberships', on_delete='CASCADE')

    class Meta:
        indexes = ((('buffer', 'user'), True),
                   )


def initialize():
    database.create_tables([UserDetails,
                            IRCServerModel,
                            IRCUserModel,
                            IRCBufferModel,
                            IRCLineModel,
                            IRCBufferMembershipRelation,
                            ], safe=True)
    try:
        logger.info('Getting')
        IRCBufferModel.get(name='System Buffer', kind='system')
    except p.DoesNotExist:
        logger.info('Creating')
        create_buffer(name='System Buffer', server=None, kind='system')


# Callback signal definitions
NEW_USER = 'new_user'
NEW_LINE = 'new_line'
NEW_BUFFER = 'new_buffer'
NEW_SERVER = 'new_server'
NEW_MEMBERSHIP = 'new_membership'
DELETED_MEMBERSHIP = 'deleted_membership'


# =========================================================================
# Controller functions
# ------------------
#
# Because we really don't need a controller class for this
# =========================================================================
def _ensure_no_current_user(nick, server, current=True, realname=None, username=None, host=None):
    """ Raises an integrity error if there already exists a current user with the given details. """
    if current:
        try:
            user = get_user(nick, server, current, realname, username, host)
        except p.DoesNotExist:
            pass
        else:
            if user.current:
                raise p.IntegrityError()


def create_user(nick, server, current=True, realname=None, username=None, host=None):
    # First we ensure that we don't already have a current user that matches
    _ensure_no_current_user(nick, server, current, realname, username, host)

    # Then we actually create a user
    user = IRCUserModel.create(nick=nick, realname=realname, username=username, host=host, server=server,
                               current=current)
    signal_factory(NEW_USER).send(None, user=user, server=user.server)
    return user


def update_user(user, nick=None, realname=None, username=None, host=None, current=None):
    # Ensure no current user exists with the target details
    _ensure_no_current_user(nick, user.server, current or user.current, realname, username, host)

    if nick is not None:
        user.nick = nick

    if realname is not None:
        user.realname = realname

    if username is not None:
        user.username = username

    if host is not None:
        user.host = host

    if current is not None:
        user.current = current

    user.save()
    signal_factory(NEW_USER).send(None, user=user, server=user.server)
    return user


def create_line(buffer, content, kind, user=None, nick=None):
    if nick is not None:
        line = IRCLineModel.create(buffer=buffer, content=content, kind=kind, user=user, nick=nick)
    elif user is not None:
        line = IRCLineModel.create(buffer=buffer, content=content, kind=kind, user=user, nick=user.nick)
    else:
        line = IRCLineModel.create(buffer=buffer, content=content, kind=kind, user=user)
    server = line.buffer.server
    signal_factory(NEW_LINE).send(None, line=line, server=server)
    return line


def create_buffer(name, server, kind=None):
    if kind is not None:
        buffer = IRCBufferModel.create(name=name, server=server, current=True, kind=kind)
    else:
        buffer = IRCBufferModel.create(name=name, server=server, current=True)
    signal_factory(NEW_BUFFER).send(None, buffer=buffer, server=buffer.server)
    return buffer


def create_membership(buffer, user):
    membership = IRCBufferMembershipRelation.create(buffer=buffer, user=user)
    signal_factory(NEW_MEMBERSHIP).send(None, membership=membership, buffer=buffer, user=user)
    return membership


def delete_membership(user, buffer):
    membership = IRCBufferMembershipRelation.get(user=user, buffer=buffer)
    membership.delete_instance()
    signal_factory(DELETED_MEMBERSHIP).send(None, membership=membership, buffer=buffer, user=user)


def create_server(host, port, secure, nick, realname, username):
    user = UserDetails.create(nick=nick, realname=realname, username=username)
    server = IRCServerModel.create(host=host, port=port, secure=secure, user=user)
    signal_factory(NEW_SERVER).send(None, server=server)
    return server
# =========================================================================


# =========================================================================
# Access functions
# ----------------
#
# Not calling them "view" because they can modify stuff
# =========================================================================
def get_user(nick, server, current=True, realname=None, username=None, host=None):
    kwargs = {'nick': nick, 'server': server, 'current': current}
    if realname is not None:
        kwargs['realname'] = realname
    if username is not None:
        kwargs['username'] = username
    if host is not None:
        kwargs['host'] = host
    return IRCUserModel.get(**kwargs)


def ensure_user(nick, server, realname=None, username=None, host=None):
    """ Gets a user by (nick, server) and updates the other properties. """
    try:
        user = create_user(nick=nick, server=server)
    except p.IntegrityError:
        user = IRCUserModel.get(nick=nick, server=server)

    changed = False
    if realname is not None:
        user.realname = realname
        changed = True
    if username is not None:
        user.username = username
        changed = True
    if host is not None:
        user.host = host
        changed = True
    if changed:
        user.save()

    return user


def ensure_buffer(name, server, kind=None):
    try:
        buffer = create_buffer(name=name, server=server, kind=kind)
    except p.IntegrityError:
        buffer = IRCBufferModel.get(name=name, server=server)
    return buffer


def ensure_membership(buffer, user):
    try:
        membership = create_membership(buffer, user)
    except p.IntegrityError:
        membership = IRCBufferMembershipRelation.get(buffer=buffer, user=user)
    return membership
# =========================================================================


SYSNICK = '-*-'


class IRCServerInterface:
    def __init__(self, server_model):
        self.server_model = server_model
        self.system_buffer = ensure_buffer(name=self.server_model.host, server=self.server_model, kind='system')
        self._user = server_model.user
        self._server_handler = None
        self.protocol_callbacks = {'privmsg': self._handle_privmsg,
                                   'notice': self._handle_notice,
                                   'join': self._handle_join,
                                   'part': self._handle_part,
                                   'quit': self._handle_quit,
                                   'rpl_namreply': self._handle_rpl_namreply,
                                   'nick': self._handle_nick,
                                   'rpl_welcome': self._handle_rpl_welcome,
                                   'rpl_motd': self._handle_rpl_motd,
                                   'rpl_topic': self._handle_rpl_topic,
                                   'rpl_topicwhotime': self._handle_rpl_topicwhotime,
                                   'rpl_notopic': self._handle_rpl_notopic,
                                   }

    @property
    def server_handler(self):
        return self._server_handler

    @server_handler.setter
    def server_handler(self, new_server_handler):
        if self._server_handler is not None:
            raise ServerAlreadyAttachedError()

        for signal, callback in self.protocol_callbacks.items():
            new_server_handler.add_callback(signal, callback)

        self._server_handler = new_server_handler

    # =========================================================================
    # Handlers
    # --------
    #
    # Callbacks that will be attached to the protocol handler.
    #
    # Callbacks all pass the server handler itself as the first argument, we
    # ignore it because we already have it, hence the "_" argument in all of
    # these.
    # =========================================================================
    def _handle_join(self, _, **kwargs):
        who = kwargs['prefix']
        channel, = kwargs['args']
        nick, username, host = protocol.parse_identity(who)

        buffer = ensure_buffer(channel, self.server_model)

        if nick == self._user.nick:  # *We* are joining a channel
            buffer.current = True
            buffer.save()

        user = ensure_user(nick=nick,
                           username=username,
                           host=host,
                           server=self.server_model)
        ensure_membership(buffer, user)
        create_line(buffer=buffer, user=user, kind='join', content='has joined the channel')

    def _handle_notice(self, _, **kwargs):
        who_from = kwargs['prefix']
        to, msg = kwargs['args']

        try:
            nick, username, host = protocol.parse_identity(who_from)
        except ValueError:
            # It's a server notice
            self._handle_server_notice(msg)
            return
        else:
            user = ensure_user(nick=nick, username=username, host=host, server=self.server_model)

        if to == self._user.nick:
            # We may have to do more parsing ¬_¬
            if msg.startswith('[') and msg[1] in '#&+!':
                # Might be a private channel notice
                try:
                    _, rest = msg.split('[', maxsplit=1)
                    channel, message = rest.split(']', maxsplit=1)
                except ValueError:
                    # It's not a channel notice
                    buffer = ensure_buffer(name=nick, server=self.server_model)
                else:
                    # It's a channel notice
                    msg = message.strip()
                    buffer = ensure_buffer(name=channel, server=self.server_model)
            else:
                buffer = ensure_buffer(name=nick, server=self.server_model)

        else:
            # It's a public channel notice
            buffer = ensure_buffer(name=to, server=self.server_model)

        create_line(buffer=buffer, user=user, kind='notice', content=msg)

    def _handle_server_notice(self, msg):
        buffer = self.system_buffer
        create_line(buffer=buffer, kind='notice', nick=SYSNICK, content=msg)

    def _handle_privmsg(self, _, **kwargs):
        who_from = kwargs['prefix']
        to, msg = kwargs['args']
        nick, username, host = protocol.parse_identity(who_from)

        if to == self._user.nick:  # Private Message
            buffer = ensure_buffer(name=nick, server=self.server_model)
        else:  # Hopefully a channel message?
            buffer = ensure_buffer(name=to, server=self.server_model)

        user = ensure_user(nick=nick, server=self.server_model)
        action_prefix = '\1ACTION '
        kind = 'message'
        if msg.startswith(action_prefix):
            msg = msg[len(action_prefix):-1]
            kind = 'action'

        create_line(buffer=buffer, user=user, kind=kind, content=msg)

    def _handle_rpl_namreply(self, _, **kwargs):
        to, channel_privacy, channel, space_sep_names = kwargs['args']
        names = space_sep_names.split(' ')
        buffer = ensure_buffer(name=channel, server=self.server_model)
        for name in names:
            user = self.get_user_by_nick(name)
            ensure_membership(user=user, buffer=buffer)

    def _handle_nick(self, _, **kwargs):
        old_nick, username, host = protocol.parse_identity(kwargs['prefix'])
        new_nick, *other_args = kwargs['args']  # shouldn't be any other args

        logger.debug('%s, %s', old_nick, self.server_handler.identity.nick)

        if new_nick == self.server_handler.identity.nick:
            # The protocol handler will update its own state as it uses the database model without saving it for storage
            # We save it because we're the database bit.
            # We want to wait until confirmation that the nick change happens from the server.
            self.server_handler.identity.save()

        user = get_user(old_nick, self.server_model)
        try:
            user = update_user(user, nick=new_nick)
        except p.IntegrityError:
            # The *IRC Server* has told us this nick change is occurring, we can safely assume no one is currently using
            # the nick
            old_user = get_user(new_nick, self.server_model)
            update_user(old_user, current=False)  # un-current the user currently using the nick
            update_user(user, nick=new_nick)  # make the change

        for relation in user.memberships:
            buffer = relation.buffer
            create_line(buffer=buffer,
                        user=user,
                        nick=old_nick,
                        kind='nick',
                        content='is now known as {}'.format(new_nick))

    def _handle_part(self, _, **kwargs):
        nick, username, host = protocol.parse_identity(kwargs['prefix'])
        channel, *other_args = kwargs['args']

        user = get_user(nick, self.server_model, current=True)
        buffer = IRCBufferModel.get(name=channel, server=self.server_model)

        if nick == self._user.nick:
            buffer.current = False
            buffer.save()

        delete_membership(user, buffer)
        create_line(buffer=buffer, user=user, kind='part', content='has left the channel')

    def _handle_quit(self, _, **kwargs):
        nick, username, host = protocol.parse_identity(kwargs['prefix'])
        *other_args, reason = kwargs['args']

        user = IRCUserModel.get(nick=nick, server=self.server_model)
        for relation in user.memberships:
            buffer = relation.buffer
            if nick == self._user.nick:
                buffer.current = False
                buffer.save()

            delete_membership(user, buffer)
            create_line(buffer=buffer, user=user, kind='quit', content='has quit ({})'.format(reason))

    def _handle_rpl_welcome(self, _, **kwargs):
        # Maybe put channel autojoin in here?
        pass

    def _handle_rpl_motd(self, _, **kwargs):
        _, line, *other_args = kwargs['args']
        create_line(buffer=self.system_buffer, nick=SYSNICK, kind='other', content=line)

    def _handle_topic(self, _, **kwargs):
        nick, username, host = protocol.parse_identity(kwargs['prefix'])
        channel, topic = kwargs['args']
        buffer = ensure_buffer(name=channel, server=self.server_model)
        create_line(buffer=buffer, nick=SYSNICK, server=self.server_model,
                    content='{} changed the topic for {} to: {}'.format(nick, channel, topic))

    def _handle_rpl_topic(self, _, **kwargs):
        _, channel, topic = kwargs['args']
        buffer = ensure_buffer(name=channel, server=self.server_model)
        create_line(buffer=buffer, nick=SYSNICK, kind='topic',
                    content='Topic for {}: {}'.format(channel, topic))

    def _handle_rpl_topicwhotime(self, _, **kwargs):
        _, channel, user, timestamp = kwargs['args']
        nick, username, host = protocol.parse_identity(user)
        buffer = ensure_buffer(name=channel, server=self.server_model)
        create_line(buffer=buffer, nick=SYSNICK, kind='topic',
                    content='Topic set by {}'.format(nick))

    def _handle_rpl_notopic(self, _, **kwargs):
        pass
    # =========================================================================

    # =========================================================================
    # Helper methods
    # --------------
    #
    # Yes, normally we don't do getters in Python but these have parameters.
    # =========================================================================
    def get_user_by_nick(self, nick):
        """ Return the user object from just the nick.

        Args:
            nick (str): Either the nick or the nick with a channel mode prefix.
        """
        # Pull @ or + off the front
        # I checked the RFC; these should be the only two chars
        # We can later use these to determine modes
        if nick[0] in '@+':
            nick = nick[1:]

        user = ensure_user(nick=nick, server=self.server_model)
        return user

    @property
    def connection_details(self):
        m = self.server_model
        return m.host, m.port, m.secure

    @property
    def identity(self):
        return self._user

    @property
    def channels(self):
        n = IRCBufferModel.name
        return self.server_model.buffers.where(n.startswith('#') |
                                               n.startswith('&') |
                                               n.startswith('+') |
                                               n.startswith('!'))
    # =========================================================================

    # =========================================================================
    # Constructors / Factories
    # =========================================================================
    @classmethod
    def new(cls, host, port, secure, user):
        server_model = create_server(host=host, port=port, secure=secure, user=user)
        return cls(server_model)

    @classmethod
    def get(cls, host, port):
        server_model = IRCServerModel.get(host=host, port=port)
        return cls(server_model)

    @classmethod
    def get_all(cls):
        models = IRCServerModel.select()
        return {model.id: cls(model) for model in models}
    # =========================================================================


def main():
    pass

if __name__ == '__main__':
    main()
