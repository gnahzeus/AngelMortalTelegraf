const messages = require("./messages");

RegisterFailedHandler = async (ctx, uuid) => {
    ctx.reply(messages.RegisterFailedGeneralError(uuid))
}

RegisterHandler = async (ctx) => {
    //If this telegram user has already registerd to a UUID
    if (ctx.person) {
        return ctx.reply(messages.AlreadyRegisteredError(ctx.person.name))
    }
    //TODO: add check for if UUID has been registered by another telegram user
    const re = /\/r(?:egister)? (\w+)/g
    const parsed = re.exec(ctx.message.text)
    if (!parsed) {
        return ctx.replyWithMarkdown(messages.RegisterReminder)
    }
    const uuid = parsed[1]
    const success = await TryRegister(ctx, uuid)
    if (!success) {
        await RegisterFailedHandler(ctx, uuid);
    }
}

RegisterSuccessHandler = async (ctx) => {
    const person = ctx.person
    const angel = ctx.model.getPersonByUuid(person.angel)
    const mortal = ctx.model.getPersonByUuid(person.mortal)

    await ctx.reply(messages.RegisterSuccess(person.name, ctx.chatTarget))

    await ctx.reply(messages.ReferToBot(ctx.chatAs))
    if (!ctx.isAngel) {
        await ctx.reply(messages.StatusHint)
    }

    if (angel.isRegistered()) {
        await ctx.model.mortalBot.telegram.sendMessage(angel.telegramId, messages.RegisteredNotifier('mortal'))
    }

    if (mortal.isRegistered()) {
        await ctx.model.angelBot.telegram.sendMessage(mortal.telegramId, messages.RegisteredNotifier('angel'))
    }
}

TryRegister = async (ctx, uuid) => {
    const model = ctx.model;
    const person = model.getPersonByUuid(uuid)

    // Failed registration if person with given uuid doesn't exist, or if already registered
    if (!person || person.isRegistered()) {
        return false
    }

    person.register(ctx.from)
    ctx.person = person
    model.saveToStorage()

    await RegisterSuccessHandler(ctx)
    return true
}

DeregisterHandler = async (ctx) => {
    if (!ctx.isRegistered) {
        return ctx.reply(messages.NotRegistered)
    }
    const model = ctx.model
    const telegramId = ctx.person.telegramId
    ctx.person.deregister()
    model.saveToStorage()
    await ctx.reply(messages.DeregisterSuccess)
    await ctx.otherBot.telegram.sendMessage(telegramId, messages.DeregisterSuccess)
}

MessageHandler = async (ctx) => {
    const target = ctx.isAngel ? ctx.angel : ctx.mortal
    if (target && target.isRegistered()) {
        const msg = ctx.update.message
        if (ctx.updateSubTypes.indexOf("animation") !== -1) {
            const fileLink = await ctx.telegram.getFileLink(msg.animation.file_id)
            return await ctx.otherBot.telegram.sendAnimation(target.telegramId, {url: fileLink})
        }
        if (ctx.updateSubTypes.indexOf("document") !== -1) {
            const fileLink = await ctx.telegram.getFileLink(msg.document.file_id)
            return await ctx.otherBot.telegram.sendDocument(target.telegramId, {url: fileLink, filename: msg.document.file_name})
        }
        return await ctx.otherBot.telegram.sendMessage(target.telegramId, ctx.message.text)
    } else {
        //Handle user possibly trying to register but in the wrong format
        if (ctx.message.text.startsWith("/r")) {
            await ctx.replyWithMarkdown(messages.RegisterReminder)
        } else {
            await ctx.reply(messages.UnregisteredTarget(ctx.chatTarget))
        }
    }
}

StickerHandler = async (ctx) => {
    const target = ctx.isAngel ? ctx.angel : ctx.mortal
    if (target.isRegistered()) {
        await ctx.otherBot.telegram.sendSticker(target.telegramId, ctx.message.sticker.file_id)
    } else {
        await ctx.reply(messages.UnregisteredTarget(ctx.chatTarget))
    }
}

PhotoHandler = async (ctx) => {
    //TODO: photos forwarded are super small thumbnail, not the original photo sent
    const photos = ctx.message.photo
    const caption = ctx.message.caption || ""
    const target = ctx.isAngel ? ctx.angel : ctx.mortal
    if (target.isRegistered()) {
        const fileLink = await ctx.telegram.getFileLink(photos[0].file_id)
        await ctx.otherBot.telegram.sendPhoto(target.telegramId, {url: fileLink}, {caption})
    } else {
        await ctx.reply(messages.UnregisteredTarget(ctx.chatTarget))
    }
}

VideoHandler = async (ctx) => {
    const video = ctx.message.video
    const caption = ctx.message.caption || ""
    const target = ctx.isAngel ? ctx.angel : ctx.mortal
    if (target.isRegistered()) {
        const fileLink = await ctx.telegram.getFileLink(video.file_id)
        await ctx.otherBot.telegram.sendVideo(target.telegramId, {url: fileLink}, {caption})
    } else {
        await ctx.reply(messages.UnregisteredTarget(ctx.chatTarget))
    }
}

VoiceHandler = async (ctx) => {
    const voice = ctx.message.voice
    const target = ctx.isAngel ? ctx.angel : ctx.mortal
    if (target.isRegistered()) {
        const fileLink = await ctx.telegram.getFileLink(voice.file_id)
        await ctx.otherBot.telegram.sendVoice(target.telegramId, {url: fileLink})
    } else {
        await ctx.reply(messages.UnregisteredTarget(ctx.chatTarget))
    }
}

VideoNoteHandler = async (ctx) => {
    const video = ctx.message.video_note
    const target = ctx.isAngel ? ctx.angel : ctx.mortal
    if (target.isRegistered()) {
        const fileLink = await ctx.telegram.getFileLink(video.file_id)
        await ctx.otherBot.telegram.sendVideoNote(target.telegramId, {url: fileLink})
    } else {
        await ctx.reply(messages.UnregisteredTarget(ctx.chatTarget))
    }
}

StatusHandler = async (ctx) => {
    if (!ctx.isRegistered) {
        return ctx.replyWithMarkdown(messages.RegisterReminder)
    }
    const person = ctx.person
    const model = ctx.model
    const mortal = model.getPersonByUuid(person.mortal)
    let mortalName = mortal.name
    ctx.reply(messages.StatusMessage(person.name, mortalName))
}

HelpHandler = async (ctx) => {
    await ctx.replyWithMarkdown(messages.HelpMessage)
}

StartHandler = async (ctx) => {
    const name = ctx.isRegistered ? " " + ctx.person.name : ""
    const message = messages.BotWelcome(name, ctx.chatTarget)
    await ctx.reply(message)
    if (!ctx.isRegistered) {
        await ctx.replyWithMarkdown(messages.RegisterReminder)
    } else {
        if (ctx.isMortal) {
            await ctx.reply(messages.StatusHint)
        }
    }
}

module.exports = {
    RegisterHandler,
    DeregisterHandler,
    TryRegister,
    RegisterSuccessHandler,
    RegisterFailedHandler,
    StatusHandler,
    MessageHandler,
    HelpHandler,
    StickerHandler,
    StartHandler,
    PhotoHandler,
    VideoHandler,
    VideoNoteHandler,
    VoiceHandler
}