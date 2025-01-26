import { utilService } from './util.service.js'
import { storageService } from './async-storage.service.js'

// const sampleLoc = {
//     id: 'GEouN',
//     name: 'Dahab, Egypt',
//     rate: 5,
//     geo: {
//         address: 'Dahab, South Sinai, Egypt',
//         lat: 28.5096676,
//         lng: 34.5165187,
//         zoom: 11
//     },
//     createdAt: 1706562160181,
//     updatedAt: 1706562160181
// }

const DB_KEY = 'locs'
var gSortBy = { rate: -1, creationTime: -1 }
var gFilterBy = { txt: '', minRate: 0 }
var gPage = { idx: 0, size: 3, pageCount: 0 }

_createLocs()

export const locService = {
    query,
    getById,
    remove,
    save,
    setFilterBy,
    setSortBy,
    getLocCountByRateMap,
    getLocCountByLastUpdated,
    getPageCount,
    setCurrPage
}

function query() {
    return storageService.query(DB_KEY)
        .then(locs => {
            if (gFilterBy.txt) {
                const regex = new RegExp(gFilterBy.txt, 'i')
                // ex 3
                // When filtering by text, also test the loc.geo.address
                locs = locs.filter(loc => regex.test(loc.name) || regex.test(loc.geo.address))
            }
            if (gFilterBy.minRate) {
                locs = locs.filter(loc => loc.rate >= gFilterBy.minRate)
            }

            // ex 2
            // Add Sorting by creation time

            if (gSortBy.rate !== undefined) {
                locs.sort((p1, p2) => (p1.rate - p2.rate) * gSortBy.rate)
            } else if (gSortBy.creationTime !== undefined) {
                locs.sort((p1, p2) => (p1.createdAt - p2.createdAt) * gSortBy.creationTime)
            } else if (gSortBy.name !== undefined) {
                locs.sort((p1, p2) => p1.name.localeCompare(p2.name) * gSortBy.name)
            }


            // No paging (unused)
            if (gPage !== undefined) {
                gPage.pageCount = Math.ceil(locs.length / gPage.size)
                const startIdx = gPage.idx * gPage.size
                locs = locs.slice(startIdx, startIdx + gPage.size)
            }

            return locs
        })
}

function getPageCount() {
    return gPage.pageCount
}

function setCurrPage(pageNum) {
    gPage.idx = pageNum
    console.log(gPage.pageCount);
}

function getById(locId) {
    return storageService.get(DB_KEY, locId)
}

function remove(locId) {
    return storageService.remove(DB_KEY, locId)
}

function save(loc) {
    if (loc.id) {
        loc.updatedAt = Date.now()
        return storageService.put(DB_KEY, loc)
    } else {
        loc.createdAt = loc.updatedAt = Date.now()
        return storageService.post(DB_KEY, loc)
    }
}

function setFilterBy(filterBy = {}) {
    if (filterBy.txt !== undefined) gFilterBy.txt = filterBy.txt
    if (filterBy.minRate !== undefined && !isNaN(filterBy.minRate)) gFilterBy.minRate = filterBy.minRate
    return gFilterBy
}

function getLocCountByRateMap() {
    return storageService.query(DB_KEY)
        .then(locs => {
            const locCountByRateMap = locs.reduce((map, loc) => {
                if (loc.rate > 4) map.high++
                else if (loc.rate >= 3) map.medium++
                else map.low++
                return map
            }, { high: 0, medium: 0, low: 0 })
            locCountByRateMap.total = locs.length
            return locCountByRateMap
        })
}

function getLocCountByLastUpdated() {
    const dateNow = Date.now()
    return storageService.query(DB_KEY)
        .then(locs => {
            const locCountByLastUpdatedMap = locs.reduce((map, loc) => {
                if (dateNow - loc.updatedAt < 1000 * 60 * 60 * 24) map.today++
                else if (loc.createdAt !== loc.updatedAt) map.past++
                else map.never++
                return map
            }, { today: 0, past: 0, never: 0 })
            locCountByLastUpdatedMap.total = locs.length
            return locCountByLastUpdatedMap
        })
}


function setSortBy(sortBy = {}) {
    gSortBy = sortBy
}

function _createLocs() {
    const locs = utilService.loadFromStorage(DB_KEY)
    if (!locs || !locs.length) {
        _createDemoLocs()
    }
}

function _createDemoLocs() {
    var locs =
        [
            {
                name: "Ben Gurion Airport",
                rate: 2,
                geo: {
                    address: "Ben Gurion Airport, 7015001, Israel",
                    lat: 32.0004465,
                    lng: 34.8706095,
                    zoom: 12,
                    img: `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=32.0004465,34.8706095&key=AIzaSyD6jPNpQ1AYA5o6hG38FbUMMyiG_s_nmxI`
                },
            },
            {
                name: "Dekel Beach",
                rate: 4,
                geo: {
                    address: "Derekh Mitsrayim 1, Eilat, 88000, Israel",
                    lat: 29.5393848,
                    lng: 34.9457792,
                    zoom: 15,
                    img: `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=29.5393848,34.9457792&key=AIzaSyD6jPNpQ1AYA5o6hG38FbUMMyiG_s_nmxI`

                },
            },
            {
                name: "Dahab, Egypt",
                rate: 5,
                geo: {
                    address: "Dahab, South Sinai, Egypt",
                    lat: 28.5096676,
                    lng: 34.5165187,
                    zoom: 11,
                    img: `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=28.5096676,34.5165187&key=AIzaSyD6jPNpQ1AYA5o6hG38FbUMMyiG_s_nmxI`

                }
            }
        ]

    locs = locs.map(_createLoc)
    utilService.saveToStorage(DB_KEY, locs)
}

function _createLoc(loc) {
    loc.id = utilService.makeId()
    loc.createdAt = loc.updatedAt = utilService.randomPastTime()
    return loc
}


// unused functions
// function getEmptyLoc(name = '') {
//     return {
//         id: '',
//         name,
//         rate: 1,
//         createdAt: Date.now(),
//         updatedAt: Date.now(),
//         geo: {
//             lat: 0,
//             lng: 0,
//             zoom: 10,
//             address: ''
//         }
//     }
// }

