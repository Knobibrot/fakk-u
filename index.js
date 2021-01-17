const fs = require('fs')
const { createCanvas, loadImage } = require('canvas')
const uheprng = require('random-seed');

// set to fakku_zid cookie value
let zid = '0000000000000000000000000000000000000000000000000000000000000000';
// load fakku data
var bookData = JSON.parse(fs.readFileSync('fakku_data.json', 'utf-8'));

// All the functions
function dataXOR(data, key) {
    let result = '';
    for (let i = 0; i < data.length; ++i)
        result += String.fromCharCode(data[i] ^ key.charCodeAt(i % key.length));
    return result;
}

function getRemapArray(arr, seed) {
    var rng = new uheprng(seed);
    var idx = arr.length;
    var ret = arr.slice(0); // copy array
    
    while (idx > 0) {
        var oldIdx = ~~(rng.random() * idx--) // ~~ is used to convert float to int
        var tmp = ret[oldIdx];
        ret[oldIdx] = ret[idx];
        ret[idx] = tmp;
    }

    return ret;
}

function getRangeArray(stop) {
    return [...Array(stop).keys()];
}

function deshuffleArray(arr, seed) {
    let ret = [];
    let remapArr = getRemapArray(getRangeArray(arr.length), seed);
    for (var i = 0; i < arr.length; ++i)
        ret[remapArr[i]] = arr[i];
    return ret;
}

async function deobfuscateImage(imageURI, imageOutputPath, pageData) {
    const canvas = createCanvas(pageData.width, pageData.height);
    const context = canvas.getContext('2d');

    // load image
    const image = await loadImage(imageURI);

    let numTilesW = Math.ceil(pageData.width / 128);
    let numTilesH = Math.ceil(pageData.height / 128);
    let lastLineOffset = 128 * numTilesW - pageData.width;

    deshuffleArray(getRangeArray(numTilesH * numTilesW), pageData.seed).map(
        function(sourceTileNum, destTileNum) {
            let sourceTileX = sourceTileNum % numTilesW;
            let sourceTileY = ((sourceTileNum - sourceTileX) / numTilesW) * 128;
            sourceTileX *= 128;
            let destTileX = destTileNum % numTilesW;
            let destTileY = ((destTileNum - destTileX) / numTilesW) * 128;
            
            if (destTileX == (numTilesW - 1)) {
                destTileX = destTileX * 128 - lastLineOffset;
            } else {
                destTileX *= 128;
            }
            
            context.drawImage(image, destTileX, destTileY, 128, 128, sourceTileX, sourceTileY, 128, 128);
        }
    );

    fs.writeFileSync(imageOutputPath, canvas.toBuffer('image/png'));
}

if (bookData.key_data) {
    let keyPart1 = zid;
    let keyPart2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    let keyData = Buffer.from(bookData.key_data, 'base64');
    let decrypted = dataXOR(keyData, keyPart1 + bookData.key_hash + keyPart2);
    let obfuscationData = JSON.parse(decrypted);
    
    for ([pageNum, pageObfsData] of Object.entries(obfuscationData)) {
        let pageData = bookData.pages[pageNum];
        let seed = pageObfsData.pop();
        pageObfsData = deshuffleArray(pageObfsData, seed);
        let pageSeed = pageObfsData[2];
        pageData.width = pageObfsData[0] ^ pageSeed;
        pageData.height = pageObfsData[1] ^ pageSeed;
        pageData.seed = pageSeed;

        if (pageNum == '1') {
            deobfuscateImage('input.png', 'output.png', pageData)
                .catch(err => console.log(err));
        }
    }
} else {
    console.log('Images are not protected!');
}
