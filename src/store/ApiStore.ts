import { defineStore } from 'pinia'
import { watch, ref } from 'vue'
import { GlobalStore } from '@/store/GlobalStore'
import { SessionStore } from '@/store/SessionStore'
import axios, { type AxiosInstance, type CancelTokenStatic } from 'axios'

import type {
  kernalType,
  mixtapeType,
  hypertextType,
  linkContentType,
  sourceUrlType
} from '@/types/ApiTypes'

const store = GlobalStore()
const sessionStore = SessionStore()
const base = sessionStore.getUrlRails
let controller = new AbortController();

watch(
  () => store.filter,
  () => { ApiStore().search() }
)
watch(
  () => store.sortBy,
  () => { ApiStore().search() }
)
watch(
  () => store.mixtape,
  () => { ApiStore().mixtapeSearch() }
)

export const ApiStore = defineStore({
  id: 'apiData',
  state: () => ({
    hypertexts: <hypertextType[]>[],
    kernals: <kernalType[]>[],
    linkContents: <linkContentType[]>[],
    sourceUrls: <sourceUrlType[]>[],
    mixtapes: <mixtapeType[]>[],
    forceGraph: <kernalType[]>[]
  }),

  actions: {
    async initialize () {
      controller.abort()
      controller = new AbortController();
      const config = {
        headers: { Authorization: sessionStore.auth_token },
        signal: controller.signal
      }
      const params = '?sort=' + store.sortBy
      const [ linkContents ] = await Promise.all([
        axios.get(base + 'link_contents' + params, config),
        this.fetchHypertexts(1)
      ])
      this.linkContents = linkContents.data
      this.fetchKernals(1),
      this.fetchMixtapes(1)
      this.fetchSourceUrls(1)
      this.fetchForceGraph()
    },

    async search () {
      controller.abort()
      controller = new AbortController();
      this.hypertexts = []
      this.linkContents = []
      this.sourceUrls = []
      this.kernals = []
      this.forceGraph = []

      let params = '?q=' + store.filter + '&sort=' + store.sortBy
      const config = {
        headers: { Authorization: sessionStore.auth_token },
        signal: controller.signal
      }
      try {
        const [ linkContents ] = await Promise.all([
          axios.get(base + 'link_contents' + params, config),
        ])
        this.linkContents = linkContents.data
        this.fetchSourceUrls(1)
        this.fetchKernals(1)
        this.fetchHypertexts(1)
        this.fetchForceGraph()
      } catch (e) {
        console.error(e);
      }
    },
    async mixtapeSearch () {
      controller.abort()
      controller = new AbortController();
      this.kernals = []
      this.forceGraph = []

      try {
        this.fetchKernals(1)
        this.fetchForceGraph()
      } catch (e) {
        console.error(e);
      }
    },

    async fetchKernals (pageNumber: number) {
      let params = '?q=' + store.filter + '&page=' + pageNumber + '&sort=' + store.sortBy
      if (store.mixtape != '') { params = params + '&mixtape=' + store.mixtape }
      const config = {
        headers: { Authorization: sessionStore.auth_token },
        signal: controller.signal
      }
      try {
        const kernals = await axios.get(base + 'kernals'+ params +'&q=' + store.filter, config)
        this.kernals = this.kernals.concat(kernals.data)
        if(this.kernals.length === store.pageSize){
          const keys: string[] = []
          for (let k in this.kernals[0]){
            if(k != 'signed_url' && k != 'signed_url_nail' && k != 'id' && k != 'file_path') {
              keys.push(k)
            }
          }
          store.setSortByValue(keys)
        }
        return kernals
      } catch (e) {
        console.error(e);
      }
    },

    async fetchHypertexts (pageNumber: number) {
      let params = '?page=' + pageNumber + '&sort=' + store.sortBy + '&q=' + store.filter
      const config = {
        headers: { Authorization: sessionStore.auth_token },
        signal: controller.signal
      }
      try {
        const hypertexts = await axios.get(base + 'hypertexts'+ params, config)
        this.hypertexts = this.hypertexts.concat(hypertexts.data)
      } catch (e) {
        console.error(e);
      }
    },

    async fetchMixtapes (pageNumber: number) {
      let params = '?page=' + pageNumber + '&sort=' + store.sortBy + '&q=' + store.filter
      const config = {
        headers: { Authorization:  sessionStore.auth_token },
        signal: controller.signal
      }
      try {
        const mixtapes = await axios.get(base + 'mixtapes'+ params, config)
        this.mixtapes = this.mixtapes.concat(mixtapes.data)
        return mixtapes
      } catch (e) {
        console.error(e);
      }
    },

    async fetchSourceUrls (pageNumber: number) {
      let params = '?page=' + pageNumber + '&sort=' + store.sortBy + '&q=' + store.filter
      const config = {
        headers: { Authorization: sessionStore.auth_token },
        signal: controller.signal
      }
      try {
        const sourceUrls = await axios.get(base + 'source_urls'+ params, config)
        this.sourceUrls = this.sourceUrls.concat(sourceUrls.data)
      } catch (e) {
        console.error(e);
      }
    },

    async fetchForceGraph () {
      let params = '?q=' + store.filter + '&forceGraph=true'
      const config = {
        headers: { Authorization: sessionStore.auth_token },
        signal: controller.signal
      }
      if (store.mixtape != '') { params = params + '&mixtape=' + store.mixtape }
      try {
        const forceGraph = await axios.get(base + 'kernals'+ params, config)
        this.forceGraph = forceGraph.data
      } catch (e) {
        console.error(e);
      }
    },

    async addMixtape(title: string) {
      const config = {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: sessionStore.auth_token }
      }
      let formData = new FormData();
      formData.append('name', title)
      if(title !== ''){
        try {
          const [ bool ] = await Promise.all([
            axios.post( sessionStore.getUrlRails + 'mixtapes', formData, config)
          ])
          this.mixtapes.unshift(bool.data)
          store.setMixtape(bool.data.id)
        } catch (e) {
          console.error(e);
        }
      }
    },

    async deleteMixtape (uuid: string) {
      const config = {
        headers: { Authorization: sessionStore.auth_token },
      }
      try {
        const del = axios.delete( sessionStore.getUrlRails + 'mixtapes/' + uuid, config)
        this.mixtapes = this.mixtapes.filter(item => item.id !== uuid)
        store.setMixtape('')
      } catch (e) {
        console.error(e);
      }
    },

    async deleteKernal (uuid: string) {
      const config = {
        headers: { Authorization: sessionStore.auth_token },
      }
      try {
        const del = axios.delete( sessionStore.getUrlRails + 'kernals/' + uuid, config)
        this.kernals = this.kernals.filter(item => item.id !== uuid)
      } catch (e) {
        console.error(e);
      }
    },

    async addKernal(formData: FormData) {
      store.setUploadView(true)
      const config = {
        onUploadProgress: function(progressEvent: any) {
          let percentCompleted = Math.round( (progressEvent.loaded * 100) / progressEvent.total )
          store.setUploadPercent(percentCompleted)
          if(percentCompleted === 100) {
            store.setUploadView(false)
            store.setUploadPercent(0)
          }
        },
        headers: { 'Content-Type': 'multipart/form-data', Authorization: sessionStore.auth_token }
      }
      if(formData.has("file_type")){
        try {
          const [ bool ] = await Promise.all([
            axios.post( sessionStore.getUrlRails + 'kernals', formData, config)
          ])
          this.kernals.unshift(bool.data)
        } catch (e) {
          console.error(e);
        }
      }
    },

  }
})

