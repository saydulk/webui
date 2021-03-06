define(['application', 'marionette', './templates/node_select.tpl', '../entities/node',
        '../../settings/views/settings', '../../settings/entities/node_config_schema',
        '../../settings/entities/node_config', 'lib/api', 'underscore', 'mousetrap', 'jquery-ui', 'lib/crosshair-slider',
        'select2', 'select2-css'],
    function(App, Marionette, template, Node, SettingsView, NodeConfigSchema, NodeConfig, api, _, Mousetrap) {
        return Marionette.View.extend({
            template: template,
            ui: {
                container: '.app-node-content',
                nodeProperties: '[data-node-property]',
                emotionList: '.app-emotion-list',
                gestureList: '.app-gesture-list',
                somaList: '.app-soma-list',
                expressionList: '.app-expression-list',
                kfAnimationList: '.app-kfanimation-list',
                textInput: '.app-node-text',
                langSelect: 'select.app-lang-select',
                attentionRegionList: '.app-attention-region-list',
                topicInput: '.app-node-topic',
                eventParamInput: '.app-node-event-param',
                btreeModeSelect: 'select.app-btree-mode-select',
                speechEventSelect: 'select.app-speech-event-select',
                hrAngleSlider: '.app-hr-angle-slider',
                hrAngleLabel: '.app-hr-angle-label',
                listenResponseTemplate: '.app-listen-response-template',
                listenResponseInputs: '.app-listen-response-template input',
                listenAddResponseButton: '.app-listen-add-response',
                listenResponseList: '.app-chat-response-list',
                removeListenResponseButton: '.app-remove-listen-response',
                enableChatbotCheckbox: '.app-enable-chatbot-checkbox',
                responsesProperty: '[data-node-property="responses"]',
                ttsPreviewButton: '.app-tts-preview',
                filterText: '.app-filter-text'
            },
            events: {
                'keyup @ui.textInput': 'setText',
                'change @ui.textInput': 'setTextDuration',
                'change @ui.langSelect': 'setLanguage',
                'change @ui.topicInput': 'setTopic',
                'change @ui.eventParamInput': 'setEventParam',
                'change @ui.listenResponseInputs': 'updateChatResponses',
                'click @ui.listenAddResponseButton': 'addListenResponse',
                'click @ui.removeListenResponseButton': 'removeListenResponse',
                'click @ui.ttsPreviewButton': 'previewTts',
                'change @ui.enableChatbotCheckbox': 'setEnableChatbot'
            },
            regions: {
                settingsEditor: '.app-settings-editor'
            },
            modelEvents: {
                change: 'modelChanged'
            },
            modelChanged: function() {
                this.ui.topicInput.val(this.model.get('topic'))
                this.ui.eventParamInput.val(this.model.get('event_param'))
            },
            onAttach: function() {
                this.initTypes()
                this.initFields()
                this.ui.container.perfectScrollbar()
            },
            onDestroy: function() {
                this.destroyListFiltering()
            },
            initTypes: function() {
                switch (this.model.get('name')) {
                    case 'speech':
                        this.listenTo(this.model, 'change:start_time', this.setTextDuration)
                        break
                }
            },
            initFields: function() {
                let self = this,
                    properties = this.model.getConfig().properties

                // display node specific properties
                this.ui.nodeProperties.hide()
                _.each(properties, function(prop) {
                    self.ui.nodeProperties.filter('[data-node-property="' + prop + '"]').show()
                })

                this.modelChanged()

                if (this.model.hasProperty('enable_chatbot')) {
                    this.ui.enableChatbotCheckbox.prop('checked', !!this.model.get('enable_chatbot'))
                    this.setEnableChatbot()
                }

                if (this.model.hasProperty('responses')) {
                    this.initChatResponses()
                    this.ui.listenAddResponseButton.click()
                }

                if (this.model.hasProperty('emotion')) {
                    // init with empty list
                    self.updateEmotions([])
                    // load emotions
                    api.getAvailableEmotionStates(function(emotions) {
                        self.updateEmotions(emotions)
                    })
                }

                if (this.model.hasProperty('expression')) {
                    // init with empty list
                    self.updateExpressions([])
                    // load emotions
                    api.expressionList(function(expressions) {
                        self.updateExpressions(expressions.exprnames)
                    })
                }

                if (this.model.hasProperty('kfanimation')) {
                    this.model.on('change', this.setKFAnimationDurationCallback, this)

                    // init with empty list
                    self.updateKFAnimations([])
                    // load emotions
                    api.getAnimations(function(animations) {
                        animations = _.pluck(animations, 'name')
                        self.updateKFAnimations(animations)
                    })
                }

                if (this.model.hasProperty('angle')) {
                    if (!this.model.get('angle'))
                        this.model.set('angle', 0)

                    this.ui.hrAngleSlider.slider({
                        animate: true,
                        range: 'min',
                        min: -50,
                        max: 50,
                        value: this.model.get('angle') * 100,
                        slide: function(e, ui) {
                            self.model.set('angle', parseFloat(ui.value) / 100.0)
                            self.model.call()
                            self.ui.hrAngleLabel.html(parseFloat(self.model.get('angle')).toFixed(2) + ' rad')
                        }
                    })
                }

                if (this.model.hasProperty('animation')) {
                    // init with empty list
                    self.updateGestures([])
                    // load gestures
                    api.getAvailableGestures(function(gestures) {
                        self.updateGestures(gestures)
                    })

                    this.model.on('change', this.setGestureLengthCallback, this)
                }

                if (this.model.hasProperty('soma')) {
                    // init with empty list
                    self.updateSomaStates([])
                    // load gestures
                    api.getAvailableSomaStates(function(somas) {
                        self.updateSomaStates(somas)
                    })
                }

                if (this.model.hasProperty('attention_region')) {
                    this.enableAttentionRegionSelect()
                }

                if (this.model.hasProperty('text')) {
                    if (!this.model.get('text'))
                        this.model.set('text', '')
                    this.ui.textInput.val(this.model.get('text'))
                }

                if (this.model.hasProperty('language')) {
                    if (!this.model.get('lang'))
                        this.model.set('lang', 'en-US')
                    api.getLanguagesList(function(languages){
                        _.each(languages, function(lang){
                            $(self.ui.langSelect).append($('<option>', {value:lang, text:lang.slice(-2)}))
                        });
                        $(self.ui.langSelect).append('audio')
                        self.ui.langSelect.val(self.model.getLanguage())
                        $(self.ui.langSelect).select2()
                    });

                }

                if (this.model.hasProperty('btree_mode')) {
                    if (!this.model.get('mode'))
                        this.model.set('mode', 255)
                    this.ui.btreeModeSelect.val(this.model.get('mode'))
                    $(self.ui.btreeModeSelect).select2()
                }

                if (this.model.hasProperty('rosnode')) {
                    this.changeRosNode()
                    this.listenTo(this.model, 'change:rosnode', function() {
                        self.model.unset('schema')
                        self.model.unset('values')
                        self.changeRosNode(true)
                    })
                }

                if (this.model.hasProperty('speech_event')) {
                    if (!this.model.get('chat'))
                        this.model.set('chat', '')
                    this.ui.speechEventSelect.val(this.model.get('chat'))
                    this.ui.speechEventSelect.select2()
                }

                if (this.model.hasProperty('message')) {
                    if (!this.model.get('message'))
                        this.model.set('message', '')
                    this.ui.messageInput.val(this.model.get('message'))
                }
            },
            initList: function(list, attr, container, options) {
                if (this.isDestroyed()) return
                this.resetFilter()
                let self = this
                options = options || {}
                container.html('')

                this.initListFiltering(container)

                if (list && list.constructor === Array)
                    list = _.sortBy(list)

                _.each(list, function(label, val) {
                    if (list.constructor === Array)
                        val = label

                    let thumbnail = $('<div>').addClass('app-node-thumbnail')
                        .attr('data-filter-val', val.toLowerCase())
                        .attr('data-node-name', self.model.get('name')).attr('data-' + attr, val)
                        .html($('<span>').html(label)).click(function() {
                            self.model.set(attr, val)
                            $('[data-' + attr + ']', container).removeClass('active')
                            $(this).addClass('active')
                            if (options.change) options.change(val)
                        }).draggable({
                            helper: function() {
                                let node = self.model

                                if (self.collection && self.collection.contains(node)) {
                                    let attributes = node.toJSON()
                                    delete attributes['id']
                                    attributes[attr] = val
                                    node = Node.create(attributes)
                                }

                                switch (self.model.get('name')) {
                                    case 'gesture':
                                        self.setGestureLength(node)
                                        break
                                    case 'kfanimation':
                                        self.setKFAnimationDuration(node)
                                        break
                                }
                                node.set(attr, val)
                                return $('<span>').attr('data-node-name', node.get('name'))
                                    .attr('data-node-id', node.get('id'))
                                    .addClass('label app-node').html(node.getTitle())
                            },
                            appendTo: 'body',
                            revert: 'invalid',
                            delay: 100,
                            snap: '.app-timeline-nodes',
                            snapMode: 'inner',
                            zIndex: 1000,
                            cursor: 'move',
                            cursorAt: {top: 0, left: 0}
                        })

                    if (typeof options.preview === 'function')
                        thumbnail.dblclick(function() {
                            options.preview(val)
                        })

                    container.append(thumbnail)
                })

                let update = function() {
                    if (self.model.get(attr)) {
                        $('[data-' + attr + ']', container).removeClass('active')
                        $('[data-' + attr + '="' + self.model.get(attr) + '"]', container).addClass('active')
                    }
                }

                this.model.on('change:' + attr, update)
                update()
            },
            filterText: '',
            setFilterText: function(text) {
                this.filterText = text
                this.ui.filterText.html(text)
            },
            filter: function(text) {
                if (typeof text !== 'undefined')
                    this.setFilterText(text)

                if (this.filterText) {
                    let filter = '[data-filter-val*="' + this.filterText + '"]'
                    this.filterContainer.find(filter).stop().fadeIn()
                    this.filterContainer.find('.app-node-thumbnail:not(' + filter + ')').stop().fadeOut()
                } else
                    this.filterContainer.find('.app-node-thumbnail').fadeIn()
            },
            resetFilter: function() {
                this.setFilterText('')
            },
            filterCallback: function(e) {
                if (e.key.length === 1)
                    this.filter(this.filterText + e.key)
            },
            initListFiltering: function(container) {
                let self = this
                this.destroyListFiltering()
                this.filterContainer = container
                this.filter_callback_ref = this.filterCallback.bind(this)
                $(document).keypress(this.filter_callback_ref)
                Mousetrap.bind('esc', function() {
                    self.filter('')
                })

                Mousetrap.bind('backspace', function() {
                    self.filter(self.filterText.length > 1 ? self.filterText.slice(0, -1) : '')
                })
            },
            destroyListFiltering: function() {
                if (this.filter_callback_ref)
                    $(document).off('keypress', this.filter_callback_ref)

                Mousetrap.unbind('esc')
                Mousetrap.unbind('backspace')
            },
            updateEmotions: function(emotions) {
                this.initList(emotions, 'emotion', this.ui.emotionList, {
                    preview: function(e) {
                        api.setEmotion(e, 1, 3)
                    }
                })
            },
            setKFAnimationDurationCallback: function() {
                this.setKFAnimationDuration(this.model)
            },
            setKFAnimationDuration: function(node) {
                let self = this
                api.getKFAnimationLength(node.get('animation'), function(response) {
                    node.set('duration', 0.1 + response.frames / self.model.get('fps'))
                })
            },
            updateKFAnimations: function(animations) {
                this.initList(animations, 'animation', this.ui.kfAnimationList)
                $(this.ui.kfModeSelect).select2()
            },
            updateExpressions: function(expressions) {
                this.initList(expressions, 'expression', this.ui.expressionList)
            },
            updateGestures: function(gestures) {
                this.initList(gestures, 'gesture', this.ui.gestureList, {
                    preview: function(e) {
                        api.setGesture(e, 1, 1)
                    }
                })
            },
            updateSomaStates: function(somas) {
                this.initList(somas, 'soma', this.ui.somaList)
            },
            changeRosNode: function(reset) {
                let self = this,
                    rosnode = this.model.get('rosnode'),
                    schemaModel = new NodeConfigSchema({}, {node_name: rosnode}),
                    schema = this.model.get('schema')

                if (reset) this.model.set('values', {})

                if (schema) {
                    schemaModel.set(schema)
                    self.showNodeSettings(schemaModel)
                } else
                    schemaModel.fetch({
                        success: function() {
                            let json = schemaModel.toJSON()
                            self.model.set('schema', json)
                            self.showNodeSettings(schemaModel)
                        },
                        error: function() {
                            self.model.set('schema', {})
                        }
                    })
            },
            showNodeSettings: function(schemaModel) {
                let self = this,
                    values = self.model.get('values'),
                    nodeConfig = new NodeConfig({}, {node_name: this.model.get('rosnode'), readonly: true}),
                    init = function() {
                        self.getRegion('settingsEditor').show(new SettingsView({
                            model: nodeConfig,
                            schemaModel: schemaModel,
                            refresh: false
                        }))

                        nodeConfig.on('change', updateValues)
                    }

                let updateValues = function() {
                    let currentView = self.getRegion('settingsEditor').currentView
                    if (currentView && currentView.model === nodeConfig)
                        self.model.set('values', nodeConfig.toJSON())
                    else
                        nodeConfig.off('change', updateValues)
                }

                if (values) {
                    nodeConfig.set(values)
                    init()
                } else
                    nodeConfig.fetch({
                        success: function() {
                            init()
                        }
                    })
            },
            setText: function() {
                this.model.set('text', this.ui.textInput.val())
            },
            setLanguage: function() {
                this.model.set('lang', this.ui.langSelect.val())
            },
            setTextDuration: function() {
                let self = this
                api.getTtsLength(this.ui.textInput.val(), this.model.getLanguage(), function(response) {
                    self.model.set('duration', response.length)
                })
            },
            previewTts: function() {
                api.robotSpeech(this.model.get('text'), this.model.get('lang'))
            },
            setGestureLengthCallback: function() {
                this.setGestureLength(this.model)
            },
            setGestureLength: function(node) {
                api.getAnimationLength(node.get('gesture'), function(response) {
                    node.set('duration', response.length / node.get('speed'))
                })
            },
            setTopic: function() {
                this.model.set('topic', this.ui.topicInput.val())
            },
            setEventParam: function() {
                this.model.set('event_param', this.ui.eventParamInput.val())
            },
            enableAttentionRegionSelect: function() {
                let self = this

                api.getRosParam('/' + api.config.robot + '/webui/attention_regions', function(regions) {
                    regions = regions || {}
                    _.each(regions, function(r, i) {
                        regions[i] = r['label']
                    })
                    regions.custom = 'custom'
                    self.initList(regions, 'attention_region', self.ui.attentionRegionList)
                })
            },
            initChatResponses: function() {
                let self = this
                self.ui.listenResponseList.html('')

                _.each(this.model.get('responses'), function(response) {
                    let template = self.ui.listenResponseTemplate.clone(),
                        input = $('.app-chat-input', template),
                        output = $('.app-chat-output', template)
                    input.val(response['input'])
                    output.val(response['output'])
                    self.ui.listenResponseList.append(template.hide().fadeIn())
                })
            },
            updateChatResponses: function() {
                let responses = [],
                    inputs = $('input', this.ui.listenResponseList),
                    i

                for (i = 0; i < inputs.length / 2; i++) {
                    let input = $(inputs[i * 2]).val(),
                        output = $(inputs[i * 2 + 1]).val()

                    if (input && output) responses.push({input: input, output: output})
                }

                this.model.set('responses', responses)
            },
            addListenResponse: function() {
                this.ui.listenResponseList.append(this.ui.listenResponseTemplate.clone().hide().fadeIn())
            },
            removeListenResponse: function(e) {
                let self = this
                $(e.target).closest('.app-listen-response-template').fadeOut(100, function() {
                    $(this).remove()
                    self.updateChatResponses()
                })
            },
            setEnableChatbot: function() {
                let checked = this.ui.enableChatbotCheckbox.is(':checked')

                this.model.set('enable_chatbot', checked ? '1' : '')

                if (checked)
                    this.ui.responsesProperty.fadeOut()
                else
                    this.ui.responsesProperty.fadeIn()
            }
        })
    })
