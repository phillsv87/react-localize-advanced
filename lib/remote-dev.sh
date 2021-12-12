#!/bin/bash

projectName='react-localization-advanced'
openFile='localization.d.ts'

root=`dirname "$0"`

dest="$1"

if [ "$dest" == "" ]; then
    dest="."
fi


dest=`realpath "$dest"`
if [ "$dest" == "" ]; then
    echo 'first argument must be location of target project'
    exit 1
fi

dest="$dest/node_modules/$projectName"

if [ ! -d "$dest" ]; then
    echo "target project does not have $projectName package installed"
    echo "$dest does not exist"
    exit 1
fi

package="$dest/package.json"
dest="$dest/dist"

bkPackage="$package.bk"
bkDir="$dest.bk"


if [ ! -d "$bkDir" ]; then
    echo "Backing up target dist. $dest > $bkDir"
    mv "$dest" "$bkDir"
    mkdir "$dest"
fi

if [ ! -f "$bkPackage" ]; then
    echo "Backing up target package. $package > $bkPackage"
    mv "$package" "$bkPackage"
fi

cp "$root/package.json" "$package"

function openCode(){
    sleep 5
    code "$dest/$openFile"
}
if [ "openFile" != "" ]; then
    openCode &
fi


cd "$root"

echo "Starting tsc in watch mode.  tsc --watch --outDir '$dest'"

trap ctrl_c INT
function ctrl_c() {
    echo " Cleaning up..."
}

npx tsc --watch --outDir "$dest"

sleep 1

wait

rm -rf "$dest"
rm "$package"
mv "$bkDir" "$dest"
mv "$bkPackage" "$package"

echo "output dir restored"