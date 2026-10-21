// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  Herald Registry
/// @notice On-chain registration of transfer-watch rules for the Herald webhook relay.
///
/// @dev    Herald is a read-only observer: it holds no funds, takes no custody, and never
///         signs for a user. This registry stores only the PUBLIC half of a watch — who owns
///         it, which chain/token it watches, the minimum value that triggers it, and the
///         https endpoint to deliver to. The HMAC signing secret is deliberately NOT stored
///         on-chain: it is generated client-side and held by the relay, keyed by watch id.
///
///         A watch is a plain data record. Registering one costs gas and nothing else —
///         there is no deposit, no fee, and no value transfer in this contract.
contract HeraldRegistry {
    /// @notice A single watch rule.
    struct Watch {
        address owner;      // can be transferred to hand the watch over
        uint256 chainId;    // chain to observe, e.g. 677 (BOT Chain) or 968 (BOT Chain testnet)
        address token;      // ERC-20 to observe; address(0) means the chain's native coin
        uint256 minValue;   // ignore transfers below this, in the token's base units
        string endpoint;    // absolute https URL the relay POSTs the signed payload to
        bool active;        // inactive watches are retained but never delivered
        uint64 createdAt;
        uint64 updatedAt;
    }

    /// @notice Longest endpoint we accept. Keeps payloads bounded for every consumer.
    uint256 public constant MAX_ENDPOINT_LEN = 200;

    uint256 public watchCount;

    mapping(uint256 => Watch) private _watches;
    mapping(address => uint256[]) private _byOwner;
    mapping(address => uint256) public activeCountOf;

    event WatchRegistered(
        uint256 indexed id,
        address indexed owner,
        uint256 chainId,
        address token,
        uint256 minValue,
        string endpoint
    );
    event WatchRuleUpdated(uint256 indexed id, address indexed owner, address token, uint256 minValue);
    event WatchEndpointUpdated(uint256 indexed id, address indexed owner, string endpoint);
    event WatchActiveChanged(uint256 indexed id, address indexed owner, bool active);
    event WatchTransferred(uint256 indexed id, address indexed from, address indexed to);

    error ZeroOwner();
    error NoSuchWatch(uint256 id);
    error NotOwner(uint256 id, address caller);
    error BadChainId();
    error EndpointTooLong(uint256 len);
    error EndpointNotHttps();

    /// @notice Register a new watch. Costs gas only; holds no funds.
    /// @param chainId  chain to observe
    /// @param token    ERC-20 address, or address(0) for the native coin
    /// @param minValue minimum transfer value that should trigger a delivery
    /// @param endpoint absolute https URL for delivery
    /// @return id the new watch id
    function register(uint256 chainId, address token, uint256 minValue, string calldata endpoint)
        external
        returns (uint256 id)
    {
        if (chainId == 0) revert BadChainId();
        _checkEndpoint(endpoint);

        id = ++watchCount;
        _watches[id] = Watch({
            owner: msg.sender,
            chainId: chainId,
            token: token,
            minValue: minValue,
            endpoint: endpoint,
            active: true,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });
        _byOwner[msg.sender].push(id);
        activeCountOf[msg.sender] += 1;

        emit WatchRegistered(id, msg.sender, chainId, token, minValue, endpoint);
    }

    /// @notice Change what a watch observes. Owner only.
    function updateRule(uint256 id, address token, uint256 minValue) external {
        Watch storage w = _owned(id);
        w.token = token;
        w.minValue = minValue;
        w.updatedAt = uint64(block.timestamp);
        emit WatchRuleUpdated(id, msg.sender, token, minValue);
    }

    /// @notice Change where a watch delivers. Owner only.
    function setEndpoint(uint256 id, string calldata endpoint) external {
        _checkEndpoint(endpoint);
        Watch storage w = _owned(id);
        w.endpoint = endpoint;
        w.updatedAt = uint64(block.timestamp);
        emit WatchEndpointUpdated(id, msg.sender, endpoint);
    }

    /// @notice Pause or resume delivery. Owner only.
    function setActive(uint256 id, bool active) external {
        Watch storage w = _owned(id);
        if (w.active == active) return;
        w.active = active;
        w.updatedAt = uint64(block.timestamp);
        activeCountOf[msg.sender] = active
            ? activeCountOf[msg.sender] + 1
            : activeCountOf[msg.sender] - 1;
        emit WatchActiveChanged(id, msg.sender, active);
    }

    /// @notice Hand a watch to another address. Owner only.
    function transferWatch(uint256 id, address to) external {
        if (to == address(0)) revert ZeroOwner();
        Watch storage w = _owned(id);
        address from = w.owner;
        w.owner = to;
        w.updatedAt = uint64(block.timestamp);
        _byOwner[to].push(id);
        if (w.active) {
            activeCountOf[from] -= 1;
            activeCountOf[to] += 1;
        }
        emit WatchTransferred(id, from, to);
    }

    // ---------------------------------------------------------------- views

    function getWatch(uint256 id) external view returns (Watch memory) {
        if (_watches[id].owner == address(0)) revert NoSuchWatch(id);
        return _watches[id];
    }

    function exists(uint256 id) external view returns (bool) {
        return _watches[id].owner != address(0);
    }

    /// @notice Ids owned by `owner`. Renounced watches are skipped.
    function watchesOf(address owner) external view returns (uint256[] memory) {
        uint256[] memory all = _byOwner[owner];
        uint256 n;
        for (uint256 i; i < all.length; ++i) if (_watches[all[i]].owner == owner) ++n;
        uint256[] memory out = new uint256[](n);
        uint256 k;
        for (uint256 i; i < all.length; ++i) if (_watches[all[i]].owner == owner) out[k++] = all[i];
        return out;
    }

    // ------------------------------------------------------------- internal

    function _owned(uint256 id) private view returns (Watch storage w) {
        w = _watches[id];
        if (w.owner == address(0)) revert NoSuchWatch(id);
        if (w.owner != msg.sender) revert NotOwner(id, msg.sender);
    }

    /// @dev The relay refuses plaintext and oversized URLs, so reject them at the source
    ///      rather than silently dropping deliveries later.
    function _checkEndpoint(string calldata endpoint) private pure {
        bytes calldata b = bytes(endpoint);
        if (b.length == 0 || b.length > MAX_ENDPOINT_LEN) revert EndpointTooLong(b.length);
        if (b.length < 8) revert EndpointNotHttps();
        if (!(b[0] == "h" && b[1] == "t" && b[2] == "t" && b[3] == "p" &&
              b[4] == "s" && b[5] == ":" && b[6] == "/" && b[7] == "/")) revert EndpointNotHttps();
    }
}
