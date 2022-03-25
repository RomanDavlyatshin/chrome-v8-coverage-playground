# Chrome V8 coverage playground

## Usage

1. Open `chrome://extensions`
2. Enable __Developer Mode__ (toggle is in the top right corner)
3. Press `"Load unpacked"` and select `extension` folder to install extension
4. Open background.html of `Chrome Coverage Playground` (blue link on the extension's card)
5. The DevTools window will open. Here, you'll see the coverage and other data printed in the `Console` tab.
6. Open your page of interest. (E.g. use `example-page-to-play-with-coverage.html` in root folder)
7. Open extension via extension pane in upper right corner, and click V8 Coverage Playground icon.
8. Follow the popup instructions
9. Make sure to __set target script URL__ to the script of interest. (E.g. your `main.js` or smth like that)
10. Once you hit "takePreciseCoverage" return to extension's background.html DevTools page and:
    - check the coverage data highlighted on the script source
    - raw json printend to console
        > TIP you can `right-click` and `copy` this data, to use for VSCode extension mentioned below

## VSCode Extension to view coverage on mapped to _original_ sources

You can use [this VSCode extension](https://github.com/RomanDavlyatshin/view-sourcemap-positions-vscode-extension) to fulfill this task
