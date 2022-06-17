# News!

All notable changes to this project will be documented here.

## [2.0.0](https://github.com/GoogleCloudPlatform/wombat-dressing-room/compare/v1.1.0...v2.0.0) (2022-06-17)


### ⚠ BREAKING CHANGES

* porting frontend code to using react (#124)

### Features

* support force delete ([#119](https://github.com/GoogleCloudPlatform/wombat-dressing-room/issues/119)) ([ab52e54](https://github.com/GoogleCloudPlatform/wombat-dressing-room/commit/ab52e5461e4af4bc9112c1849075dba3983ecef8))
* treating unpublished dpackages as if they were new ([#104](https://github.com/GoogleCloudPlatform/wombat-dressing-room/issues/104)) ([b033dda](https://github.com/GoogleCloudPlatform/wombat-dressing-room/commit/b033ddac2c5f3bb06d55187e38e6ffe0ef8700ed))


### Bug Fixes

* **deps:** update dependency dotenv to v10 ([#110](https://github.com/GoogleCloudPlatform/wombat-dressing-room/issues/110)) ([b668ff8](https://github.com/GoogleCloudPlatform/wombat-dressing-room/commit/b668ff813eb6d67e451ee30ac23e225218c742a8))
* **deps:** update dependency dotenv to v16 ([#137](https://github.com/GoogleCloudPlatform/wombat-dressing-room/issues/137)) ([3c54af7](https://github.com/GoogleCloudPlatform/wombat-dressing-room/commit/3c54af732390a6fe3f795e48cee41906cc0d9422))
* **deps:** update dependency react-scripts to v5.0.1 ([#155](https://github.com/GoogleCloudPlatform/wombat-dressing-room/issues/155)) ([a3c261b](https://github.com/GoogleCloudPlatform/wombat-dressing-room/commit/a3c261b3b6a7bff3406bda2f572a43566ce85e86))


### Code Refactoring

* porting frontend code to using react ([#124](https://github.com/GoogleCloudPlatform/wombat-dressing-room/issues/124)) ([bb8ab0d](https://github.com/GoogleCloudPlatform/wombat-dressing-room/commit/bb8ab0decf6a0b9ab612d9d8107c9159b3abf0a6))

## [1.1.0](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/compare/v1.0.1...v1.1.0) (2021-02-24)


### Features

* adding support for using permsRepo ([#76](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/76)) ([782665e](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/782665ec88ca706e6032ef85c9dee64e6543d23e))
* allow a candidate release to be published to next tag ([#66](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/66)) ([833dad5](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/833dad53cb9936d342231ef5da2e442786586be5))
* allow package version to be unpublished ([#87](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/87)) ([1d88788](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/1d88788984e2f157c56822cb2261710ca4949454))
* support monorepos with release-backed tokens ([#86](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/86)) ([ddb5421](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/ddb54214581137d299b61fd942185cb4aab8cecc))


### Bug Fixes

* allow for permsRepo without repository ([#79](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/79)) ([f552d02](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/f552d020a6fc7af1b9a20828c447f05c3a151c3a))
* check up to 12 pages of tags ([#92](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/92)) ([4565a0c](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/4565a0c7cfe126a6581cb852eded0d4a87eacef8))
* **deps:** update dependency @google-cloud/datastore to v6 ([#72](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/72)) ([6acd781](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/6acd78194028034a6a94da56ed5ee50e288308d7))
* **deps:** update dependency express-handlebars to v4 ([#61](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/61)) ([9a84725](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/9a84725b06b91150773c2ababab92f775cf2cbd1))
* **deps:** update dependency express-handlebars to v5 ([#75](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/75)) ([47de140](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/47de140381c7e80f7566c5bfffb74244c7e30f0b))
* **deps:** update dependency octonode to ^0.10.0 ([#88](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/88)) ([49081bf](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/49081bf252dfa02c68d7174fb4aad2a52b9773ae))
* **deps:** update dependency uuid to v7 ([#57](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/57)) ([5a6ff4e](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/5a6ff4e0c516fd13a545e56890f0d2a341a46c67))
* **deps:** update dependency uuid to v8 ([#69](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/69)) ([a6271c1](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/a6271c165b076348b48493a938b2684c8dbfd07b))
* fixes bug with repo url handling ([#97](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/97)) ([93638a0](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/93638a0feec55817de6726894301bb7b0a9790d3))
* login was broken due to missing JS import ([#51](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/51)) ([571e124](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/571e12419e926814bba262abfb5c94770147d933))
* **release-backed:** look at tags rather than releases ([#84](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/84)) ([9ebafd1](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/9ebafd10dc69c51eb313ceac9389b3849b4089f2))

### [1.0.1](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/compare/v1.0.0...v1.0.1) (2020-01-15)


### Bug Fixes

* fixing repo related publish errors ([#46](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/46)) ([d9d7049](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/d9d7049b304895fa1afd5be7788815032f8a07c3))

## 1.0.0 (2020-01-11)


### ⚠ BREAKING CHANGES

* initial commit of project

### Features

* adds delete dist tags ([#4](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/4)) ([0cdbb69](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/0cdbb692578856c48b2532d250f5bac8269f71ac))
* generate tokens backed by GitHub releases as 2FA ([#10](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/10)) ([fee686f](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/fee686f52f80a133e43f71a0aab7edc2207d0a20))
* initial commit of project ([8cf7135](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/8cf71353fa2efcf6a0859eee9d2e305885b0d5bd))
* **deps:** update to latest and greatest @google-cloud/datastore ([#28](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/28)) ([5a2398f](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/5a2398f348ca96d821674fa23f52613b45f9c719))


### Bug Fixes

* clean require 2fa ([#5](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/5)) ([c5a4fef](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/c5a4fefe37f51302308948c4c81d662e867910f4))
* fix self-xss from package name in manage tokens ([464807f](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/464807f4c22bb212b5b4109394e72366b4368b81))
* fixes case where request may be drained twice ([#14](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/14)) ([8132fea](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/8132fea6058c1b052cdf345cdd25338114327873))
* logic bug when detecting initial publications ([#17](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/17)) ([3a0f328](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/3a0f32806050e54d413768c942bdc579c6abf97d))
* set x-frame-options to deny ([#3](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/3)) ([1a3ec1b](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/1a3ec1b4060e27a23e716972b8bf8051336bf32e))
* **deps:** update dependency dotenv to v8 ([#25](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/25)) ([d9c8f4c](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/d9c8f4cb534e7cfbeb85afdabb8a9243b43ff5db))
* **deps:** update dependency github-markdown-css to v3 ([#26](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/26)) ([a418c20](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/a418c206ff6832af7755733f37b690e1bfb7b774))
* upgrade to @otplib/core 12 ([#37](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/37)) ([ff7484a](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/ff7484abf15aa03eba5087ec7708fbc7182af4aa))


### Reverts

* Revert "fix: upgrade to @otplib/core 12 (#37)" (#38) ([2ca632c](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/commit/2ca632c53360c70e78d8c0845f43d79de2bb23d2)), closes [#37](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/37) [#38](https://www.github.com/GoogleCloudPlatform/wombat-dressing-room/issues/38)

## 0.0.4 (2019-07-30)

* support for fetching package metadata (used by learna).

## 0.0.3 (2019-07-23)

* support for `npm dist-tag`.

## 0.0.2 (2019-05-15)

* support for `npm deprecate`.

## 0.0.1 (2019-04-25)

* support for per package registry urls. no more login before every publish.
