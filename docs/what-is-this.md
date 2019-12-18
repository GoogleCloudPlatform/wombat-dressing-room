# Wombat Dressing Room, an npm Publication Proxy

I'm excited to announce that we're open-sourcing the proxy we use on the 
Google Cloud Client Libraries team for handling npm publications, it's called
[Wombat Dressing Room][wombat-dressing-room]. Wombat Dressing Room provides features that
help npm work better with automation, without fully sacrificing security.

## A tradeoff folks often make

npm has top notch security features: CIDR-range restricted tokens,
publication notfications, two-factor authentication... Of these, a feature
critical to protecting publications is [two-factor authentication (2FA)][two-factor-auth].

2FA requires that you provide two pieces of information when accessing a protected
resource: _"something you know"_ (_for instance, a password_); and _"something
you have"_ (_for instance, a code from an [authenticator app]_). With 2FA, if your
password is exposed, an attacker still can't publish a malicious packages
(unless they also steal the _"something you have"_.)

On my team, a small number of developers manage 75+ Node.js libraries. We see
automation as key to making this possible: we've written tools that automate
releases, validate license headers, ensure contributors
have signed CLAs; we adhere to the philosophy, _automate all the things!_

> It's difficult to automate the step of entering a code off a
  cellphone. As a result, folks often opt to turn off 2FA in their automation.

What if you could have both automation and the added security of 2FA? 
This is what we built [Wombat Dressing Room] for...

## A different approach to authentication

With Wombat Dressing Room, rather than an individual configuring two factor authentication in an authenticator app, 2FA is managed by a shared proxy
server. Publications are then directed at the Wombat Dressing Room proxy, which
provides the following security features:

### Per-package publication tokens.

Wombat Dressing Room can generate authentication tokens tied to repositories on
GitHub. These tokens are tied to a single GitHub repository, which the user
generating the token must have push permissions for.

If a per-package publication token is leaked, an attacker gains the ability to
publish malicious code to only a single package in an account.

### Limited lifetime tokens

Wombat Dressing Room can also generate access tokens that have a 24 hour
lifespan. In this model, a leaked token is only vulnerable until the the 24
hour lifespan is hit, reducing the attack surface.

### GitHub for 2FA

In this authentication model, a package can only be published to npm if a GitHub release
with the same version number is found on GitHub.

This introduces a true "second factor", as users must prove
they have access to both Wombat Dressing Room and the repository on GitHub.

## Getting started with Wombat Dressing Room

We've been using Wombat Dressing Room internally for a year now, it's been
working great for our publication process. As of today, the source
available for everyone on GitHub under an Apache 2.0 license.

Wombat Dressing Room runs on Google App Engine, and instructions
on getting it up and running can be found in its [README.md] and in [docs/usage.md]

It's my hope that this will help other folks in the community simplify,
and automate their release process, while minimizing the attack surface of
their packages.

-- Ben.

[two-factor-auth]: https://en.wikipedia.org/wiki/Multi-factor_authentication
[wombat-dressing-room]: https://github.com/GoogleCloudPlatform/wombat-dressing-room