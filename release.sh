set -e

if [ -z "$1" ]; then
  echo "usage: release.sh [<version> | patch | minor | major]"
  exit 1
fi

TAG=$(npm version $1 --git-tag-version)
git push
git push origin $TAG
gh release create $TAG
