var collect = Buffer.from([]);

function body_filter(r, data, flags) 
{
    if( r.status != 200 ) 
    {
        r.sendBuffer( data, flags );
        return;
    }

    collect = Buffer.concat([collect, data]);

    if (! flags.last) return;
     
    let res = JSON.parse( collect.toString() );
    collect = Buffer.from([]);
    
    let ret = { State: { Status: "unknown" } };
    
    if( res.State )
    {
        ret.State = { 
            Running: res.State.Running,
            Status:  res.State.Status
        } 
        if( res.State.Health )
            ret.State.Health = { 
                Status: res.State.Health.Status 
        };
    }
    
    r.sendBuffer( JSON.stringify(ret), flags);
}

function header_filter(r)
{
    if( r.status == 200 ) r.headersOut[ "Content-Length" ] = null;
}

export default {header_filter,body_filter};
