import 'arrive'
import { SettingsSection } from 'spcr-settings'
import Localize from './localize'
const i18n = new Localize()

type Metadata = {
    title: string | undefined,
    artist?: string
}

type MetadataWithUri = Metadata & {
    uri: string
}

var settings: SettingsSection

export default async function() {
    while (!Spicetify) {
        await new Promise(resolve => setTimeout(resolve, 100))
    }

    settings = new SettingsSection(i18n.loc('settings.title'), 'share-on-twitter')
    settings.addToggle('enable-tweet-button', i18n.loc('settings.tweet-button'), true, restartNotification)
    settings.addToggle('enable-context-menu', i18n.loc('settings.share-button'), true, restartNotification)
    settings.addToggle('enable-hashtag', i18n.loc('settings.add-hashtag'), true)
    await settings.pushSettings()

    if (settings.getFieldValue('enable-context-menu')) new Spicetify.ContextMenu.Item(i18n.loc('app.share-on-twitter'), share, void (0), 'twitter').register()

    document.arrive('.main-nowPlayingBar-right > *', { existing: true, onceOnly: true }, (element) => {
        if (!settings.getFieldValue('enable-tweet-button')) return

        const button = document.createElement('div')
        button.id = 'share-on-twitter'
        button.innerHTML = `<button class="control-button" style="padding: 8px;" aria-label="${i18n.loc('app.share-on-twitter')}" aria-describedby="share-on-twitter">
            <svg role="presentation" style="fill: currentColor" viewBox="0 0 16 16" height="16" width="16">
                <path d="M13.54 3.889q.984-.595 1.333-1.683-.905.54-1.929.738-.42-.452-.996-.706-.575-.254-1.218-.254-1.254 0-2.143.889-.889.889-.889 2.15 0 .318.08.691-1.857-.095-3.484-.932-1.627-.838-2.762-2.242-.413.714-.413 1.523 0 .778.361 1.445t.988 1.08q-.714-.009-1.373-.374v.04q0 1.087.69 1.92.691.834 1.739 1.048-.397.111-.794.111-.254 0-.571-.055.285.912 1.063 1.5.778.587 1.77.603-1.659 1.302-3.77 1.302-.365 0-.722-.048Q2.619 14 5.15 14q1.358 0 2.572-.361 1.215-.361 2.147-.988.933-.627 1.683-1.46.75-.834 1.234-1.798.484-.964.738-1.988t.254-2.032q0-.262-.008-.397.88-.635 1.508-1.563-.841.373-1.738.476z"></path>
            </svg>
        </button>`

        button.addEventListener('click', () => {
            const current = Spicetify.Player.data?.track
            if (!current) {
                return Spicetify.showNotification(i18n.loc('message.not-playing'))
            }

            tweet({
                uri: current.uri,
                title: current.metadata?.title,
                artist: current.metadata?.artist_name
            })
        })

        element.prepend(button)
    })
}

async function share(uris: string[]) {
    const uri = uris[0]
    const type = uri.split(':')[1]
    const base62 = uri.split(':')[2]

    let meta: Metadata | null
    switch (type) {
        case Spicetify.URI.Type.TRACK: {
            meta = await fetch.track(base62)
            break
        }
        case Spicetify.URI.Type.ALBUM: {
            meta = await fetch.album(base62)
            break
        }
        case Spicetify.URI.Type.ARTIST: {
            meta = await fetch.artist(base62)
            break
        }
        case Spicetify.URI.Type.SHOW: {
            meta = await fetch.show(base62)
            break
        }
        case Spicetify.URI.Type.EPISODE: {
            meta = await fetch.episode(base62)
            break
        }
        case Spicetify.URI.Type.PLAYLIST:
        case Spicetify.URI.Type.PLAYLIST_V2: {
            meta = await fetch.playlist(uri)
            break
        }
        default: {
            meta = null
            break
        }
    }

    if (!meta) return Spicetify.showNotification(i18n.loc('message.non-supported-type'))

    tweet(Object.assign(meta, { uri }))
}

function tweet(meta: MetadataWithUri) {
    var parsedURI = meta.uri.split(':')
    var tweetText = `${meta.title || i18n.loc('app.unknown')}${meta.artist ? ` - ${meta.artist}`: ''}\nhttps://open.spotify.com/${parsedURI[1]}/${parsedURI[2]}`

    var contents = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    if (settings.getFieldValue('enable-hashtag')) contents += '&hashtags=Spotify'

    window.open(contents.replace('\n', '%0D%0A'))
}

const fetch = {
    track: async (base62: string) => {
        const res = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${base62}`)
        return {
            title: res.name,
            artist: res.artists.map((artist: { [key: string]: string }) => artist.name).join(', ')
        }
    },
    album: async (base62: string) => {
        const res = await Spicetify.CosmosAsync.get(`wg://album/v1/album-app/album/${base62}/desktop`)
        return {
            title: res.name
        }
    },
    artist: async (base62: string) => {
        const res = await Spicetify.CosmosAsync.get(`wg://artist/v1/${base62}/desktop?format=json`)
        return {
            title: res.info.name,
        }
    },
    show: async (base62: string) => {
        const res = await Spicetify.CosmosAsync.get(
            `sp://core-show/unstable/show/${base62}?responseFormat=protobufJson`,
            { policy: { list: { index: true } } }
        )
        return {
            title: res.header.showMetadata.name,
            artist: i18n.loc('app.podcast'),
        }
    },
    episode: async (base62: string) => {
        const res = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/episodes/${base62}`)
        return {
            title: res.name,
            artist: `${res.show.name} ${i18n.loc('app.episode')}`,
        }
    },
    playlist: async (uri: string) => {
        const res = await Spicetify.CosmosAsync.get(
            `sp://core-playlist/v1/playlist/${uri}/metadata`,
            { policy: { picture: true, name: true } }
        )
        return {
            title: res.metadata.name,
            artist: i18n.loc('app.playlist'),
        }
    }
}

function restartNotification() {
    Spicetify.showNotification(i18n.loc('message.settings-notification'))
}