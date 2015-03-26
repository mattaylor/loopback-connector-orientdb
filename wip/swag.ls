YAML = require 'js-yaml'
_ = require 'prelude-ls'
fs = require 'fs'
Promise = require "bluebird"
https = require 'https'

env  = 'acc-dev'
desc = YAML.safeLoad fs.readFileSync './apiDoc.yaml', 'utf8'

swag =
	swagger:'2.0'
	info: title:'Pharos API', description:'Proteus Digital Health API', version:'v1.0'
	host: env+'.proteus.io'
	basePath :'/v1'
	consumes	: ["application/json"]
	produces	: ["application/json"]
	security : [ accessToken : []] # [\subject, \useradmin, \manager, \practitioner, \support] ]
	securityDefinitions:
		accessToken:
			type: "apiKey"
			name: "access"
			in: "query"
	definitions: {}
	paths: {}

hosts =
	dev	:'10.163.106.16'
	stage	:'10.166.109.17'
	ci		:'10.163.111.12'
	prod	:'10.224.202.11'
	med-dev:'10.229.123.11'
	acc-dev:'10.229.122.11'
	med-int:'10.229.147.11'
	acc-int:'10.229.44.11'

apiModel  = (dbMod, doc||{}, props={}) ->
	if desc.models[dbMod.superClass] then doc = desc.models[dbMod.superClass] with doc 
	for prop in dbMod.properties then props[prop.name]? = apiProp prop, description:doc[prop.name]
	props['@rid'] = type: 'string', format:'#\\d+:\\d+', description:dbMod.name+' Record Id'
	props['rid'] = type: 'string', format:'\\d+:\\d+', description:dbMod.name+' Record Id (shortened)'
	reqs = _.filter (?), _.map (-> it.name if it.name[0] != '_' && it.mandatory), dbMod.properties
	res = description : doc?._get || doc?._desc, type:'object', properties:props, title:dbMod.name
	if reqs.length then res.required = reqs
	res
	#anyOf: [res, type: 'string', format:'#\\d+:\\d+', description:dbMod.name+' Record Id']

log = (ob, key='') -> console.log key ,':', ob

apiPaths = (model, op={}) ->
	if desc.models[model.name]._get then op.get = apiGet model
	if desc.models[model.name]._put then op.put = apiPut model
	if desc.models[model.name]._post then op.post = apiPost model
	op

apiResp = (model, prefix) ->
	200: description: prefix+' '+model.name, schema: type:'array', items: modRef model.name

#modRef = (name) -> if name then $ref: '#/definitions/'+name else {}
modRef = (name) -> if name then $ref: name else {}

apiGet = (model) ->
	responses: apiResp model, 'Fetch'
	description: desc.models[model.name]._get
	tags:  (desc.models[model.name]._tags || '').split!
	parameters: [
		* in: 'query', name:'fields', type:'array', collectionFormat:'csv', description:'Fields to return',items:type:'string'
		* in: 'path', name:'filter', description:'Query Filter', type:'string'
		* in: 'query', name:'options', type:'string', description:'Query Modifiers'
		* in: 'query', name:'access', type:'string', description:'Access Token'
	]

apiPost =  (model) ->
	responses : apiResp model, 'Create'
	tags:  (desc.models[model.name]._tags || '').split!
	parameters: [
		* in:'body', name:model.name, description:'New '+model.name+' parameters', schema: modRef model.name
		* in:'query',name:'access', description:'Access Token', type:'string'
	]
	description: 'Create '+desc.models[model.name]._post

apiPut = (model) ->
	responses : apiResp model, 'Update'
	tags:  (desc.models[model.name]._tags || '').split!
	parameters: [
		* in:'body', name:'merge', description:'Updated '+model.name+' parameters', schema: type:'object'
		* in:'path', name:'filter', description:'Record Id', type:'string'
		* in:'query',name:'access', description:'access token', type:'string'
	]
	description: 'Update '+desc.models[model.name]._put

#linkRef = (name) -> anyOf: [{ $ref: name } ]
linkRef = (name) -> anyOf: [{type:"string", description: name+' Record Id', format:"#\\d+:\\d+"}, { $ref: name } ]
#linkRef = (name) -> { $ref: name }

apiProp = (oprop, jprop={})  ->
	#otype = Oriento.types[oprop.type]
	if oprop.name[0] == '_' then return
	if oprop.name == 'dirty' then return
	otype = oprop.type.toLowerCase!
	olink = oprop.linkedClass
	if olink
		if olink == 'OUser' then olink = 'user'
		if !desc.models[olink] then return
	switch otype
	case 'linklist' then jprop = type:'array', items: linkRef olink
	case 'linkset' then jprop =  type:'array', items: linkRef olink
	case 'linkmap' then jprop =  type:'object'
	case 'link' then jprop = linkRef olink
	case 'embeddedlist' then jprop = type : 'array', items: type:'string'
	case 'embeddedset' then jprop = type : 'array', items: type:'string'
	case 'embeddedmap'  then jprop.type = 'object'
	case 'datetime'  	  then jprop = type:'string', format:'datetime'
	case 'long' then jprop.type = 'integer'
	case 'float' then jprop.type = 'number'
	case 'double' then jprop.type = 'number'
	default jprop.type = otype

	#jprop.description? = oprop.custom.get('description')
	#jprop.default? = oprop.custom.get('default')
	#jprop.example? = oprop.custom.get('example')
	jprop

modSpec = (mod, spec) ->
	doc = desc.models[mod.name] || {}
	if !doc._desc && !doc._get then return spec
	spec.definitions[mod.name] = apiModel mod, doc
	if !doc._get && !doc._post && !doc._put then return spec
	paths = apiPaths mod
	if paths !== {} then spec.paths["/"+mod.name+"/{filter}"] =  paths
	spec

funResp = (doc) ->
	if !doc then return
	if typeof doc == 'string' then return type:'string', description:doc
	if doc.length then return type:'array', items: funResp doc[0]
	for name, prop of doc then if prop then doc[name] = funResp prop else doc[name] = $ref: name
	doc

funSpec = (func, spec, params=[]) ->
	doc = desc.funcs[func.name]
	console.log 'FUNCT:', func
	try
		matches = func.code.match /\*\*\s([^/]*)\s\*\*/
		if matches?[1] then doc <<< YAML.load matches[1]
	catch
		console.log 'YAML:', e
	if !doc?._desc then return spec
	funApi = description:doc._desc,responses:200:description:doc._desc,schema:type:'object',properties:funResp doc._out
	if doc._tags then funApi.tags = funApi.tags = doc._tags.split! else funApi.tags = ['Misc Functions']
	path = "/!"+func.name
	if func.parameters then for param in func.parameters
		path += "/{#param}"
		params.push in:'path', name:param, type:'string', description:doc[param]
	if doc._inp then params.push in:'body', name:'body', schema: funResp doc._inp
	if params.length then funApi.parameters = params
	if func.idempotent then spec.paths[path]=get:funApi else spec.paths[path]=post:funApi
	spec

proGet = (path, call, body='') -> new Promise (resolve, reject) ->
	console.log 'fetching '+env+' '+path
	access='FHBNSmbK716fR1GsCWZBEV4+ke4CS38k90j8CMX0qghJDa2wuCbQSfk3g0dOVbcFbeILfgslaZR3oWwXs9n7Ww=='
	https.get 'https://'+env+'.proteus.io/v1/'+ path+'?access='+access, (res) ->
		res.on 'error',(e) -> console.log path+' error ', e.message; reject e
		res.on 'data', (chunk) -> body += chunk
		res.on 'end',  (oBody = JSON.parse body) ->
			if oBody.result
				if oBody.result.length == 1 then resolve oBody.result[0]
				else resolve oBody.result
			else resolve oBody

resRefs =  (spec) ->
	orig = {} <<< spec
	for modId, model of orig.definitions then for proId, prop of model.properties then if prop.anyOf?[1]?.$ref
		console.log "resolving #modId . #proId as ["+ prop.anyOf[1].$ref+"]"
		#spec.definitions[modId].properties[proId].anyOf[1] = {} <<< orig.definitions[prop.anyOf[1].$ref]
		spec.definitions[modId].properties[proId].anyOf[1] = JSON.parse JSON.stringify orig.definitions[prop.anyOf[1].$ref]
		#console.log spec.definitions[modId].properties[proId].anyOf[1]
	spec

mods = []
funs = []

for id, mod of desc.models then mods.push proGet '@'+id
for id, fun of desc.funcs  then funs.push proGet 'OFunction/name='+id
Promise.all mods .then (mods)  ~> Promise.all funs .then (funs)  ~>
	spec =  swag
	for fun in funs then spec = funSpec fun, spec
	for mod in mods then spec = modSpec mod, spec
	#spec = resRefs spec
	fs.writeFileSync "./apiSwag.yaml", YAML.safeDump spec, skipInvalid:true
	fs.writeFileSync "./apiSwag.json", JSON.stringify spec

