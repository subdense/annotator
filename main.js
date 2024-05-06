import http from 'https://unpkg.com/isomorphic-git@beta/http/web/index.js'
const routes = {
    index: "/",
    profile: "/profile",
    dashboard: "/dashboard",
    global: "/global"
}
var GITHUB_TOKEN
var GITHUB_USERNAME
const app = document.querySelector("#app")
// Leaflet styles for the polygons
const leftRightStyle = {
    "color": "#ff7800",
    "weight": 5,
    "opacity": 0.25,
    "dashArray": "20 20",
    "dashOffset": "10",
    "fill": false
};
const leftLeftStyle = {
    "color": "#78ff00",
    "weight": 2,
    "opacity": 0.8,
    "fill": false
};
const rightRightStyle = {
    "color": "#ff7800",
    "weight": 2,
    "opacity": 0.8,
    "fill": false
};
const rightLeftStyle = {
    "color": "#78ff00",
    "weight": 5,
    "opacity": 0.25,
    "dashArray": "20 20",
    "dashOffset": "10",
    "fill": false
};
async function loadPage(page, title) {
    switch (page) {
        case routes.index:
            app.innerHTML = await (await fetch("pages/home.html")).text()
            cleanProgresBarNav()
            break
        case routes.profile:
            app.innerHTML = await (await fetch("pages/profile.html")).text()
            break
        case routes.dashboard:
            app.innerHTML = await (await fetch("pages/dashboard.html")).text()
            loadDashboard()
            break
        case routes.global:
            app.innerHTML = await (await fetch("pages/global_dashboard.html")).text()
            break
        default:
            break
    }
    document.title = title
}

function handleLinks() {
    const links = document.querySelectorAll("a")
    links.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault()
            loadPage(e.target.pathname, e.target.pathname)
        });
    });
}

function loadDashboard() {
    cleanProgresBarNav()
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (token && username) {
        GITHUB_TOKEN = token
        GITHUB_USERNAME = username
        loadDatasets()
    } else {
        var myModal = document.getElementById('myModal')
        var myInput = document.getElementById('username')
        var myButton = document.getElementById('saveToken')
        myModal.addEventListener('shown.bs.modal', function () {
            myInput.focus()
        })
        myButton.addEventListener('click', function (event) {
            // save token in local storage (browser)
            const token = document.getElementById("token").value;
            localStorage.setItem("token", token);
            const username = document.getElementById("username").value;
            localStorage.setItem("username", username);
            GITHUB_TOKEN = token
            GITHUB_USERNAME = username
            loadDatasets()
        })
        new bootstrap.Modal(myModal).show()
    }
}
function createProgress(progressValue, max = 100) {
    var progressDiv = document.createElement('div');
    progressDiv.className = "progress"
    var progressBarDiv = document.createElement('div');
    var bg = "bg-danger"
    if (max == 100) {
        if (progressValue == 100) {
            bg = "bg-success"
        } else if (progressValue >= 75) {
            bg = "bg-info"
        } else if (progressValue >= 50) {
            bg = ""
        } else if (progressValue >= 25) {
            bg = "bg-warning"
        }
    }
    progressBarDiv.className = "progress-bar " + bg
    progressBarDiv.role = "progressbar"
    progressBarDiv.ariaValueNow = progressValue
    progressBarDiv.ariaValueMin = 0
    progressBarDiv.ariaValueMax = max
    if (max == 100) {
        progressBarDiv.style = `width: ${progressValue}%`
        progressBarDiv.innerHTML = `${progressValue}%`
    } else {
        progressBarDiv.style = `width: ${Math.floor(100*progressValue/max)}%`
        progressBarDiv.innerHTML = `${progressValue}/${max}`
    }
    progressDiv.appendChild(progressBarDiv)
    return progressDiv
}
function fisherYatesShuffle(arr) {
    // Make a predictable pseudorandom number generator using the username
    var myrng = new Math.seedrandom(GITHUB_USERNAME)
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(myrng() * (i + 1));  // random index
        [arr[i], arr[j]] = [arr[j], arr[i]];          // swap
    }
}
function cleanProgresBarNav() {
    document.getElementById("progressbarNav").innerHTML = ""
}
function updateProgressBarNav(current,max) {
    cleanProgresBarNav()
    let pbn = document.getElementById("progressbarNav")
    let pbnDiv = document.createElement("div")
    pbnDiv.className = "p-0"
    let pbnDivName = document.createElement("div")
    pbnDivName.className = "m-1 align-middle"
    pbnDivName.style = "font-size: .75rem"
    pbnDivName.innerHTML = "Tasks"
    pbnDiv.appendChild(pbnDivName)
    let pbnProgress = createProgress(current,max)
    pbnProgress.style="width:100%;height: 10px;font-size:.75rem"
    pbnDiv.appendChild(pbnProgress)
    pbn.appendChild(pbnDiv)
}
async function startAnnotation(datasetName) {
    console.log(`Annotation for ${datasetName}`)
    app.innerHTML = await (await fetch("pages/annotate.html")).text()
    document.title = `Annotation for ${datasetName}`
    const datasetSamples = JSON.parse(await pfs.readFile(`${dir}/${datasetName}/samples.json`))
    const dates = datasetSamples["dates"]
    const wmts = datasetSamples["wmts"]
    const samples = datasetSamples["samples"]
    var todo = {}
    for (const sample of samples) {
        const sampleName = sample.split('/')[1]
        console.log("sample = " + sampleName)
        const datasetTasks = JSON.parse(await pfs.readFile(`${dir}/${sample}`))
        console.log(`tasks before sort: ${datasetTasks["tasks"]}`)
        var tasks = datasetTasks["tasks"]
        const total = tasks.length
        fisherYatesShuffle(tasks)
        console.log(`tasks before removal: ${tasks}`)
        if (GITHUB_USERNAME in datasetTasks) {
            // user has annotated some tasks
            const userTasks = datasetTasks[GITHUB_USERNAME]
            if (userTasks.length != tasks.length) {
                // not finished
                tasks.splice(0, userTasks.length)
                console.log(`tasks after removal: ${tasks}`)
                todo[sampleName] = { "sample": sample, "tasks": tasks, "total": total}
            }
        } else {
            todo[sampleName] = { "sample": sample, "tasks": tasks, "total": total }
        }
    }
    console.log(todo)
    // Add the leaflet maps
    const mapLeft = L.map('mapLeft', { attributionControl: false });
    const mapRight = L.map('mapRight', { zoomControl: false });
    // Add a label on top right with user login
    let LoginControl = L.Control.extend({
        onAdd: function (map) {
            var div = L.DomUtil.create('div', 'leaflet-bar my-control');
            div.innerHTML = GITHUB_USERNAME;
            return div;
        }
    });
    new LoginControl({ position: 'bottomleft' }).addTo(mapLeft);
    let DateControlL = L.Control.extend({
        onAdd: function (map) {
            var div = L.DomUtil.create('div', 'leaflet-bar my-control');
            div.innerHTML = dates[0];
            return div;
        }
    });
    new DateControlL().addTo(mapLeft);
    let DateControlR = L.Control.extend({
        onAdd: function (map) {
            var div = L.DomUtil.create('div', 'leaflet-bar my-control');
            div.innerHTML = dates[1];
            return div;
        }
    });
    new DateControlR().addTo(mapRight);
    // Add the WMTS layers
    var lyrLeft = L.geoportalLayer.WMTS({ layer: wmts[0] }, { maxZoom: 20, maxNativeZoom: 18 });
    var lyrRight = L.geoportalLayer.WMTS({ layer: wmts[1] }, { maxZoom: 20, maxNativeZoom: 18 });
    lyrLeft.addTo(mapLeft);
    lyrRight.addTo(mapRight);
    // Add the zoom
    const ZoomViewer = L.Control.extend({
        onAdd() {
            const gauge = L.DomUtil.create('div', 'leaflet-bar my-control');
            mapRight.on('zoomstart zoom zoomend', (ev) => { gauge.innerHTML = `Zoom level: ${mapRight.getZoom()}`; });
            return gauge;
        }
    });
    new ZoomViewer({ position: 'bottomleft' }).addTo(mapRight);
    // Read the next file from github
    async function nextTaskFromTodo() {
        const firstSample = Object.keys(todo)[0]
        console.log(`firstSample=${firstSample}`)
        const firstSampleFile = todo[firstSample]["sample"]
        console.log(`firstSampleFile=${firstSampleFile}`)
        const remainingTasksInSample = todo[firstSample]["tasks"].length
        const totalTasksInSample = todo[firstSample]["total"]
        console.log(`Tasks remaining: ${remainingTasksInSample} out of ${totalTasksInSample}`)
        const firstTask = todo[firstSample]["tasks"].shift()
        console.log(`firstTask=${firstTask}`)
        if (todo[firstSample]["tasks"].length == 0) {
            delete todo[firstSample]
        }
        return [firstSampleFile, firstTask, remainingTasksInSample, totalTasksInSample]
    }
    let [nextSampleFile, nextTask, remainingTasksInSample, totalTasksInSample] = await nextTaskFromTodo()
    updateProgressBarNav(totalTasksInSample-remainingTasksInSample,totalTasksInSample)
    console.log(`Next Task is: ${nextTask} associated with sample ${nextSampleFile}`)
    let fileContent = JSON.parse(await pfs.readFile(`${dir}/${nextTask}`))
    console.log(`fileContent = ${fileContent}`)
    let geoJSONLeft = L.geoJSON(fileContent, { filter: function (feature, layer) { return feature.properties.date == dates[0]; }, style: leftLeftStyle });
    let geoJSONLeftRight = L.geoJSON(fileContent, { filter: function (feature, layer) { return feature.properties.date == dates[1]; }, style: leftRightStyle });
    let geoJSONRight = L.geoJSON(fileContent, { filter: function (feature, layer) { return feature.properties.date == dates[1]; }, style: rightRightStyle });
    let geoJSONRightLeft = L.geoJSON(fileContent, { filter: function (feature, layer) { return feature.properties.date == dates[0]; }, style: rightLeftStyle });
    geoJSONLeft.addTo(mapLeft);
    geoJSONLeftRight.addTo(mapLeft);
    geoJSONRight.addTo(mapRight);
    geoJSONRightLeft.addTo(mapRight);
    mapLeft.setView(geoJSONRight.getBounds().getCenter(), 18);
    mapLeft.sync(mapRight);
    mapRight.sync(mapLeft);
    var newValue = { "tag": "none", "qualityIssue": false };
    console.log("newValue = ", newValue);
    var buttonDict = Object.fromEntries(["construction", "destruction", "stable", "split", "merge", "reallocation", "skip"].map((name) => [name, document.getElementById(name)]));
    function updateButtons() {
        for (const [aKey, aButton] of Object.entries(buttonDict)) {
            if (aKey == newValue["tag"]) aButton.classList.add("active");
            else aButton.classList.remove("active");
        };
        document.getElementById("qualityIssue").checked = newValue["qualityIssue"];
    }
    // updateButtons();
    async function updateTask() {
        [nextSampleFile, nextTask, remainingTasksInSample, totalTasksInSample] = await nextTaskFromTodo()
        updateProgressBarNav(totalTasksInSample-remainingTasksInSample,totalTasksInSample)
        console.log(`Next Task is: ${nextTask} associated with sample ${nextSampleFile}`)
        fileContent = JSON.parse(await pfs.readFile(`${dir}/${nextTask}`))
        console.log(`fileContent = ${fileContent}`)
        // remove previous geojsons
        geoJSONLeft.remove();
        geoJSONLeftRight.remove();
        geoJSONRight.remove();
        geoJSONRightLeft.remove();
        // add new geojsons
        geoJSONLeft = L.geoJSON(fileContent, { filter: function (feature, layer) { return feature.properties.date == dates[0]; }, style: leftLeftStyle });
        geoJSONLeftRight = L.geoJSON(fileContent, { filter: function (feature, layer) { return feature.properties.date == dates[1]; }, style: leftRightStyle });
        geoJSONRight = L.geoJSON(fileContent, { filter: function (feature, layer) { return feature.properties.date == dates[1]; }, style: rightRightStyle });
        geoJSONRightLeft = L.geoJSON(fileContent, { filter: function (feature, layer) { return feature.properties.date == dates[0]; }, style: rightLeftStyle });
        geoJSONLeft.addTo(mapLeft);
        geoJSONLeftRight.addTo(mapLeft);
        geoJSONRight.addTo(mapRight);
        geoJSONRightLeft.addTo(mapRight);
        // update view
        mapLeft.setView(geoJSONRight.getBounds().getCenter(), 18);
        mapLeft.sync(mapRight);
        mapRight.sync(mapLeft);
        newValue = { "tag": "none", "qualityIssue": false };
        updateButtons();
    }
    let saveBtn = document.getElementById("save");
    saveBtn.onclick = async function () {
        let sampleFileContent = JSON.parse(await pfs.readFile(`${dir}/${nextSampleFile}`))
        if (GITHUB_USERNAME in sampleFileContent) {
            sampleFileContent[GITHUB_USERNAME].push(newValue)
        } else {
            sampleFileContent[GITHUB_USERNAME] = [newValue]
        }
        console.log("saving newValue = ", newValue);
        await pfs.writeFile(`${dir}/${nextSampleFile}`, JSON.stringify(sampleFileContent, undefined, 2), 'utf8')

        await git.add({ fs, dir, filepath: `${nextSampleFile}` })
        await git.status({ fs, dir, filepath: `${nextSampleFile}` })

        let sha = await git.commit({ fs, dir, message: `Annotation of ${nextTask}`, author: { name: GITHUB_USERNAME } })
        console.log(sha)
        let pushResult = await git.push({
            fs, http, dir: dir, remote: 'origin', ref: 'main',
            onAuth: () => ({ username: GITHUB_TOKEN })
        })
        console.log(pushResult)
        updateTask();
    };
    for (const [aKey, aButton] of Object.entries(buttonDict)) {
        aButton.onclick = function () {
            newValue["tag"] = aKey
            updateButtons()
            console.log(newValue)
        };
    };
    document.getElementById("qualityIssue").onclick = function () { newValue["qualityIssue"] = document.getElementById("qualityIssue").checked; }
}

async function loadDatasets() {
    // Initialize a file system (and wipe the directory if it exists)
    window.fs = new LightningFS('fs', { wipe: true })
    // Use the Promisified version
    window.pfs = window.fs.promises
    window.dir = '/datasets'
    await pfs.mkdir(dir);
    // Clone the repo
    await git.clone({
        fs,
        http,
        dir,
        corsProxy: 'https://cors.isomorphic-git.org',
        url: 'https://github.com/subdense/datasets',
        ref: 'main',
        singleBranch: true,
        depth: 10,
        // onAuth: () => ({
        //     oauth2format: 'github',
        //     token: GITHUB_TOKEN,
        // })
    });
    // Read the contents of the datasets.json file
    const datasetsContent = JSON.parse(await pfs.readFile(`${dir}/datasets.json`))
    // Get the dashboard main div named 'datasets'
    const datasetsDiv = document.querySelector("#datasets")
    // Add a div to display the username (useful for annotations)
    var usernameDiv = document.createElement('div');
    usernameDiv.id = "username";
    usernameDiv.className = 'p-3';
    var usernameLabel = document.createElement('h2');
    usernameLabel.innerHTML = `User: ${GITHUB_USERNAME}`
    usernameDiv.appendChild(usernameLabel)
    datasetsDiv.appendChild(usernameDiv)
    for (const dataset of datasetsContent["datasets"]) {
        const datasetName = dataset.split('/')[0]
        console.log(`dataset = ${datasetName} (from ${dataset})`);
        const datasetSamples = JSON.parse(await pfs.readFile(`${dir}/${dataset}`))
        var tasks = 0
        var finishedTasks = 0
        var collapseDiv = document.createElement('div');
        collapseDiv.className = "collapse"
        collapseDiv.id = `${datasetName}-collapse`
        for (const sample of datasetSamples["samples"]) {
            const datasetTasks = JSON.parse(await pfs.readFile(`${dir}/${sample}`))
            var sampleFinishedTasks = 0
            if (GITHUB_USERNAME in datasetTasks) {
                sampleFinishedTasks = datasetTasks[GITHUB_USERNAME].length
            }
            var sampleTasks = datasetTasks["tasks"].length
            // for (const task of datasetTasks["tasks"]) {
            //     sampleTasks += 1
            //     const sampleTask = JSON.parse(await pfs.readFile(`${dir}/${task}`))
            //     if (GITHUB_USERNAME in sampleTask) { sampleFinishedTasks += 1 }
            // }
            tasks += sampleTasks
            finishedTasks += sampleFinishedTasks
            const datasetSampleProgress = Math.floor(sampleFinishedTasks * 100 / sampleTasks)
            const collapseSampleProgressDiv = createProgress(datasetSampleProgress)
            collapseSampleProgressDiv.className = "progress col-8"
            const sampleName = sample.split('/')[1]
            console.log(`sample ${sampleName} = ${sampleFinishedTasks} / ${sampleTasks}`)
            var sampleDiv = document.createElement('div')
            sampleDiv.className = "col-2"
            sampleDiv.innerHTML = `sample ${sampleName}`
            var collapseSampleDiv = document.createElement('div');
            collapseSampleDiv.className = "row mb-3"
            collapseSampleDiv.appendChild(sampleDiv)
            collapseSampleDiv.appendChild(collapseSampleProgressDiv)
            collapseDiv.appendChild(collapseSampleDiv)
        }
        const datasetUserProgress = Math.floor(finishedTasks * 100 / tasks)
        console.log(`Tasks: ${tasks} - ${finishedTasks} => ${datasetUserProgress}`)
        var topDatasetDiv = document.createElement('div');
        topDatasetDiv.id = datasetName;
        // Create the inner div before appending to the body
        var datasetNameDiv = document.createElement('div');
        datasetNameDiv.className = "d-flex bd-highlight mb-3"
        var datasetNameLabel = document.createElement('label');
        datasetNameLabel.className = "p-2"
        datasetNameLabel.innerHTML = `<b>${datasetName}</b>`
        var goButton = document.createElement('button');
        goButton.type = "button"
        goButton.className = "btn btn-primary"
        goButton.innerHTML = "Go"
        if (datasetUserProgress == 100) {
            goButton.disabled = true
        }
        goButton.addEventListener("click", function () {
            startAnnotation(datasetName)
        })
        var detailsButton = document.createElement('button');
        detailsButton.type = "button"
        detailsButton.className = "ms-auto btn btn-secondary"
        detailsButton.innerHTML = "Show details"
        detailsButton.setAttribute("data-bs-toggle", "collapse")
        detailsButton.setAttribute("data-bs-target", `#${datasetName}-collapse`)
        detailsButton.setAttribute("aria-expanded", "false")
        detailsButton.setAttribute("aria-controls", `${datasetName}-collapse`)
        datasetNameDiv.appendChild(datasetNameLabel)
        datasetNameDiv.appendChild(goButton)
        datasetNameDiv.appendChild(detailsButton)
        const datasetProgressDiv = createProgress(datasetUserProgress)
        datasetProgressDiv.className = "progress mb-3"
        topDatasetDiv.appendChild(datasetNameDiv)
        topDatasetDiv.appendChild(datasetProgressDiv)
        topDatasetDiv.appendChild(collapseDiv)
        // Then append the whole thing onto the body
        datasetsDiv.appendChild(topDatasetDiv);
    }
}

handleLinks()
loadPage("/", "Home")
