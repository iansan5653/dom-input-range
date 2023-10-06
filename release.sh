# usage: `release.sh [<version> | patch | minor | major]`
set -e

TAG=$(npm version $1 --git-tag-version)
git push
git push origin $TAG
gh release create $TAG
