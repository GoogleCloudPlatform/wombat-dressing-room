# News!

All notable changes to this project will be documented here.

## 0.1.0 (2019-12-23)


### ⚠ BREAKING CHANGES

* Initial open source release of project.

### Features

* adds delete dist tags ([#4](https://github.com/googleapis/wombat-dressing-room/issues/4)) ([0cdbb69](https://github.com/googleapis/wombat-dressing-room/commit/0cdbb692578856c48b2532d250f5bac8269f71ac))
* generate tokens backed by GitHub releases as 2FA ([#10](https://github.com/googleapis/wombat-dressing-room/issues/10)) ([fee686f](https://github.com/googleapis/wombat-dressing-room/commit/fee686f52f80a133e43f71a0aab7edc2207d0a20))

### Bug Fixes

* clean require 2fa ([#5](https://github.com/googleapis/wombat-dressing-room/issues/5)) ([c5a4fef](https://github.com/googleapis/wombat-dressing-room/commit/c5a4fefe37f51302308948c4c81d662e867910f4))
* fix self-xss from package name in manage tokens ([464807f](https://github.com/googleapis/wombat-dressing-room/commit/464807f4c22bb212b5b4109394e72366b4368b81))
* set x-frame-options to deny ([#3](https://github.com/googleapis/wombat-dressing-room/issues/3)) ([1a3ec1b](https://github.com/googleapis/wombat-dressing-room/commit/1a3ec1b4060e27a23e716972b8bf8051336bf32e))

## 0.0.4 (2019-07-30)

* support for fetching package metadata (used by learna).

## 0.0.3 (2019-07-23)

* support for `npm dist-tag`.

## 0.0.2 (2019-05-15)

* support for `npm deprecate`.

## 0.0.1 (2019-04-25)

* support for per package registry urls. no more login before every publish.
