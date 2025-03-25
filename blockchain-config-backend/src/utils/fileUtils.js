const fs = require("fs");
const path = require("path");

exports.createDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

exports.writeFile = (filePath, content) => {
    fs.writeFileSync(filePath, content, "utf8");
};


exports.copyFile = (src, dest) => {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    } else {
        throw new Error(`Source file does not exist: ${src}`);
    }
};