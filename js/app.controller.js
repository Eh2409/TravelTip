import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onSaveLoc,
    oncloseModal,
    onSlide,
    onSetCurrPage,
    onPageMove,
}

var gUserPos
var gSelectedLocId = null

/// SLIDER VARS
var gMoveSlider
var gActiveImage = 0
var gIsForward = true

///
var gQueryParams = { locId: '', pageId: 0, txt: '', minRate: 0, sortBy: 'rate', dir: '' }

function onInit() {

    setgQueryParams()
    getFilterByFromQueryParams()
    onSetCurrPage(getpageIdFromQueryParams())
    setSortByFromQueryParams()

    loadAndRenderLocs()
    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })

    window.addEventListener('resize', () => {
        onSlide()
    })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()

    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''

        // ex 4
        // If user-position is known (user pressed the my-position button and approved to
        // access his position) show distance to locations

        const distance = (gUserPos) ? 'Distance: ' + setDistance(loc) + ' KM' : ''

        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span>${distance}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')"><i class="fa-solid fa-trash"></i></button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')"><i class="fa-solid fa-pen"></i></button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')"><i class="fa-solid fa-map"></i></button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        if (selectedLoc) {
            displayLoc(selectedLoc)
        }

    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function setDistance(loc) {
    const { lat, lng } = loc.geo
    var latLng = { lat, lng }
    const distance = utilService.getDistance(gUserPos, latLng, 'K')
    return distance
}

function onRemoveLoc(locId) {

    // ex 1 
    //Remove location – add confirmation (use confirm)

    const isConfirm = confirm('Are you sure you want to remove this location?')
    if (!isConfirm) return

    locService.remove(locId)
        .then(() => {
            flashMsg('Location removed')
            unDisplayLoc()
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot remove location')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

// ex 6
// Add and Update location – change from prompts to <dialog> modal.

function onAddLoc(geo) {
    const elModal = document.querySelector('.add-edit-location-modal')
    document.querySelector('.loc-name-input').value = geo.address || 'Just a place'
    elModal.dataset.geo = JSON.stringify(geo)
    elModal.showModal()
}

function onUpdateLoc(locId) {
    gSelectedLocId = locId

    locService.getById(locId)
        .then(loc => {
            document.querySelector('.loc-name-input').value = loc.name
            document.querySelector('.loc-rating-input').value = loc.rate

            const elModal = document.querySelector('.add-edit-location-modal')
            elModal.showModal()
        })
}

function onSaveLoc(ev) {
    ev.preventDefault()

    const locName = document.querySelector('.loc-name-input').value
    const locRting = +document.querySelector('.loc-rating-input').value
    const elModal = document.querySelector('.add-edit-location-modal')


    if (gSelectedLocId) {
        locService.getById(gSelectedLocId)
            .then(loc => {
                loc.name = locName
                loc.rate = locRting
                locService.save(loc)
                    .then(savedLoc => {
                        flashMsg(`The location has been successfully updated!`)
                        loadAndRenderLocs()
                    })
                    .catch(err => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot update location')
                    })
                    .finally(() => gSelectedLocId = null)
            })
    } else {
        const loc = {
            name: locName,
            rate: locRting,
            geo: JSON.parse(elModal.dataset.geo),
        }
        locService.save(loc)
            .then((savedLoc) => {
                flashMsg(`Added Location (id: ${savedLoc.id})`)
                gQueryParams.locId = savedLoc.id
                setUpdateQueryParams()
                loadAndRenderLocs()
            })
            .catch(err => {
                console.error('OOPs:', err)
                flashMsg('Cannot add location')
            })
    }

    elModal.close()
    const elFrom = document.querySelector('.add-edit-location-modal form')
    elFrom.reset()
}
function oncloseModal() {
    const elModal = document.querySelector('.add-edit-location-modal')
    elModal.close()
    const elFrom = document.querySelector('.add-edit-location-modal form')
    elFrom.reset()
}

function loadAndRenderLocs() {
    locService.query()
        .then(res => {
            renderLocs(res)
            gActiveImage = 0
            renderSlider(res)
            renderPages()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            gUserPos = latLng
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    console.log(loc);

    el.querySelector('.loc-img').src = loc.geo.img

    // ex 4.5
    const distance = (gUserPos) ? 'Distance: ' + setDistance(loc) + ' KM' : ''
    el.querySelector('.loc-distance').innerHTML = distance

    el.classList.add('show')

    gQueryParams.locId = loc.id
    setUpdateQueryParams()
}

function unDisplayLoc() {
    gQueryParams.locId = ''
    setUpdateQueryParams()
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({ txt, minRate })

    const elMineRte = document.querySelector('.min-rate')
    elMineRte.innerHTML = minRate

    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function setSortByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const sortBy = queryParams.get('sortBy')
    const dir = queryParams.get('dir')
    console.log(dir);
    console.log(gQueryParams);

    document.querySelector('.sort-by').value = sortBy
    if (dir === 'checked') document.querySelector('.sort-desc').checked = true

    // onSetSortBy()
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1
    gQueryParams.sortBy = prop
    gQueryParams.dir = (isDesc) ? 'checked' : ''

    setUpdateQueryParams()

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    locService.setFilterBy({ txt, minRate: +minRate })
    if (txt === undefined) gQueryParams.txt = gQueryParams.txt
    else gQueryParams.txt = txt
    if (minRate) gQueryParams.minRate = +minRate


    onSetCurrPage()
    setUpdateQueryParams()
    loadAndRenderLocs()

    const elMineRte = document.querySelector('.min-rate')
    elMineRte.innerHTML = gQueryParams.minRate
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })
    // ex 5
    locService.getLocCountByLastUpdated().then(dates => {
        handleStats(dates, 'loc-stats-last-updated')

    })
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors(selector)

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}


// slider 

function renderSlider(locs) {
    var strHTML = locs.map(loc => {
        return `
         <div class="loc-item-img">
        <div class="loc-name">${loc.name}</div>
        <img src="${loc.geo.img}" alt="" class="loc-image-slide">
        </div>`}).join('')

    const elWrapper = document.querySelector('.wrapper')
    elWrapper.innerHTML = strHTML || '<img src="img/no-loc-img.jpg" alt="no-img-loc" class="no-img">'

    sliderAutoMove()
}


function sliderAutoMove() {
    if (gMoveSlider) return
    const elItems = document.querySelectorAll('.loc-item-img')

    if (elItems.length === 1) return
    gMoveSlider = setInterval(() => {
        if (gIsForward) {
            if (gActiveImage < elItems.length - 1) {
                gActiveImage++
            } else {
                gIsForward = false;
                gActiveImage--
            }
        } else {
            if (gActiveImage > 0) {
                gActiveImage--
            } else {
                gIsForward = true
                gActiveImage++
            }
        }
        onSlide();
    }, 1000 * 10)
}

function onSlide(diff = 0) {
    const elWrapper = document.querySelector('.wrapper')
    const elItems = document.querySelectorAll('.loc-item-img')

    if (gMoveSlider && diff != 0) {
        clearInterval(gMoveSlider)
        gMoveSlider = null
        setTimeout(sliderAutoMove, 1000 * 20)
    }

    var currActive = gActiveImage + diff
    if (currActive > elItems.length - 1 || currActive < 0) return

    gActiveImage = currActive
    const move = elItems[gActiveImage].offsetWidth * gActiveImage

    elWrapper.scrollLeft = move
}

//// pagination

function renderPages() {
    const elPagesBtns = document.querySelector('.pages-btns')
    var pageCount = locService.getPageCount()
    var currPage = getpageIdFromQueryParams()
    var strHtml = ''

    for (let i = currPage - 2; i <= currPage + 2; i++) {
        if (i < 0 || i > pageCount - 1) continue
        strHtml += `<button onclick="app.onSetCurrPage(${i})" class="page-btn num-${i}">${i + 1}</button>`
    }

    elPagesBtns.innerHTML = strHtml
    setActivePageBtn(currPage)
}

function onSetCurrPage(pageId = 0) {
    // modal
    locService.setCurrPage(pageId)
    gQueryParams.pageId = pageId
    setUpdateQueryParams()
    // dom
    loadAndRenderLocs()
}

function onPageMove(dif) {
    var currPage = getpageIdFromQueryParams()
    var pageCount = locService.getPageCount()
    var pageNum = currPage + dif
    if (pageNum < 0 || pageNum > pageCount - 1) return
    onSetCurrPage(pageNum)
}

function setActivePageBtn(pageId) {
    const elPagesBtns = document.querySelectorAll('.page-btn')
    if (!elPagesBtns.length) return

    console.log(`.page-btn.num-${gQueryParams.pageId}`);
    console.log(document.querySelector(`.page-btn.num-${gQueryParams.pageId}`));


    document.querySelector(`.page-btn.num-${gQueryParams.pageId}`).classList.remove('active')
    document.querySelector(`.page-btn.num-${pageId}`).classList.add('active')
}

function getpageIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const pageId = +queryParams.get('pageId') || 0
    return pageId
}

function setUpdateQueryParams() {
    utilService.updateQueryParams(gQueryParams)
}

function setgQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    gQueryParams.locId = queryParams.get('locId') || ''
    gQueryParams.pageId = +queryParams.get('pageId') || 0
    gQueryParams.txt = queryParams.get('txt') || ''
    gQueryParams.minRate = +queryParams.get('minRate') || 0
    gQueryParams.sortBy = queryParams.get('sortBy') || 'rate'
    gQueryParams.dir = queryParams.get('dir') || ''
    utilService.updateQueryParams(gQueryParams)
} 