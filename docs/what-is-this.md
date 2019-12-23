# Wombat Dressing Room, an npm Publication Proxy on GCP

I'm excited to announce that we're open-sourcing the proxy we use on the 
Google Cloud Client Libraries team for handling npm publications, it's called
[Wombat Dressing Room][wombat-dressing-room]. _Wombat Dressing Room_ provides features that
help npm work better with automation, while minimally sacrificing security.

## A tradeoff is often made for automation

npm has top notch security features: CIDR-range restricted tokens,
publication notifications, two-factor authentication... Of these, a feature
critical to protecting publications is [two-factor authentication (2FA)][two-factor-auth].

2FA requires that you provide two pieces of information when accessing a protected
resource: _"something you know"_ (_for instance, a password_); and _"something
you have"_ (_for instance, a code from an [authenticator app][authenticator]_). With 2FA, if your
password is exposed, an attacker still can't publish a malicious package
(unless they also steal the _"something you have"_.)

On my team, a small number of developers manage over 75 Node.js libraries. We see
automation as key to making this possible: we've written tools that automate
releases, validate license headers, ensure contributors
have signed CLAs; we adhere to the philosophy, _[automate all the things!][robots]_

> It's difficult to automate the step of entering a code off a
  cellphone. As a result, folks often opt to turn off 2FA in their automation.

What if you could have both automation and the added security of 2FA? 
This is why we've been building [Wombat Dressing Room][wombat-dressing-room].

## A different approach to authentication

With _Wombat Dressing Room_, rather than an individual configuring two factor authentication in an authenticator app, 2FA is managed by a shared proxy
server. Publications are then directed at the _Wombat Dressing Room_ proxy, which
provides the following security features:

### Per-package publication tokens.

_Wombat Dressing Room_ can generate authentication tokens tied to repositories on
GitHub. These tokens are tied to a single GitHub repository, which the user
generating the token must have push permissions for.

If a per-package publication token is leaked, an attacker can only hijack the
single package that the token is associated with.

### Limited lifetime tokens

_Wombat Dressing Room_ can also generate access tokens that have a 24 hour
lifespan. In this model, a leaked token is only vulnerable until the 24
hour lifespan is hit, reducing the attack surface.

### GitHub Releases as 2FA

In this authentication model, a package can only be published to npm if a GitHub release
with a corresponding tag is found on GitHub.

This introduces a true "second factor", as users must prove
they have access to both _Wombat Dressing Room_ and the repository on GitHub.

## Getting started with Wombat Dressing Room

We've been using Wombat Dressing Room to manage GCP client libraries for over
year now, in our fully automated library release process.
As of today, the source is available for everyone on GitHub under an Apache 2.0
license.

_Wombat Dressing Room_ runs on Google App Engine, and instructions
on getting it up and running can be found in its [README.md][readme].

It's my hope that this will help other folks in the community simplify,
and automate their release process, while minimizing the attack surface of
their libraries.

* [Wombat Dressing Room on GitHub][wombat-dressing-room].
* [Google Cloud Client Libraries](https://github.com/googleapis).

-- Ben.

[authenticator]: https://en.wikipedia.org/wiki/Google_Authenticator
[readme]: [https://github.com/GoogleCloudPlatform/wombat-dressing-room/blob/master/README.md]
[two-factor-auth]: https://en.wikipedia.org/wiki/Multi-factor_authentication
[wombat-dressing-room]: https://github.com/GoogleCloudPlatform/wombat-dressing-room
[robots]: https://youtu.be/I0Kyebda6kY